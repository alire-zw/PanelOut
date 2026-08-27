import type { FastifyInstance, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { log } from '../../lib/logger.js'
import { telegramAuthMiddleware } from '../middleware/telegram-auth.js'
import { requireUserMiddleware } from '../middleware/require-user.js'
import { serializeUser } from '../../users/user.serializer.js'
import { isPrismaUniqueError } from '../../users/user.service.js'
import {
  completeKycIdentitySchema,
  saveKycCardSchema,
  sendPhoneOtpSchema,
  verifyKycCardMatchSchema,
  verifyPhoneOtpSchema,
} from '../../kyc/kyc.schema.js'
import { getPhoneOtpStatus, KycPhoneOtpError, sendPhoneOtp, verifyPhoneOtp } from '../../kyc/phone-otp.service.js'
import { completeKycIdentity, KycIdentityError } from '../../kyc/identity.service.js'
import { acceptKycTerms } from '../../kyc/terms.service.js'
import { saveKycBankCard } from '../../kyc/card.service.js'
import { KycVerifyError, verifyCardNationalMatch, verifyShahkarMatch } from '../../kyc/verify.service.js'

function parseBody<T>(schema: { parse: (value: unknown) => T }, body: unknown): T {
  return schema.parse(body)
}

function handleRouteError(error: unknown, reply: FastifyReply, scope: string): void {
  if (error instanceof ZodError) {
    reply.code(400).send({
      error: 'ValidationError',
      message: error.issues[0]?.message ?? 'Invalid request data',
      details: error.flatten(),
    })
    return
  }

  if (error instanceof KycPhoneOtpError) {
    const status =
      error.code === 'COOLDOWN'
        ? 429
        : error.code === 'ALREADY_REGISTERED'
          ? 409
          : error.code === 'SMS_FAILED'
            ? 502
            : error.code === 'TOO_MANY_ATTEMPTS' || error.code === 'INVALID'
              ? 400
              : 400

    reply.code(status).send({
      error: error.code,
      message: error.message,
      ...(error.retryAfterSeconds !== undefined
        ? { retryAfterSeconds: error.retryAfterSeconds }
        : {}),
    })
    return
  }

  if (error instanceof KycIdentityError) {
    reply.code(error.code === 'ALREADY_COMPLETED' ? 409 : 400).send({
      error: error.code,
      message: error.message,
    })
    return
  }

  if (error instanceof KycVerifyError) {
    const status =
      error.code === 'MISMATCH'
        ? 422
        : error.code === 'FACILITY_ERROR'
          ? 502
          : error.code === 'ALREADY_COMPLETED'
            ? 409
            : 400

    reply.code(status).send({
      error: error.code,
      message: error.message,
    })
    return
  }

  if (isPrismaUniqueError(error)) {
    reply.code(409).send({
      error: 'Conflict',
      message: 'این کد ملی قبلاً ثبت شده است',
    })
    return
  }

  log.error(scope, error instanceof Error ? error.message : 'Unknown route error')
  reply.code(500).send({ error: 'InternalServerError', message: 'Unexpected server error' })
}

export async function kycRoutes(app: FastifyInstance): Promise<void> {
  const authChain = [telegramAuthMiddleware, requireUserMiddleware]

  app.get('/phone/status', { preHandler: authChain }, async (request, reply) => {
    try {
      const status = await getPhoneOtpStatus(request.dbUser!.id)
      reply.send(status)
    } catch (error) {
      handleRouteError(error, reply, 'KYC')
    }
  })

  app.post('/phone/send', { preHandler: authChain }, async (request, reply) => {
    try {
      const body = parseBody(sendPhoneOtpSchema, request.body)
      const result = await sendPhoneOtp(request.dbUser!.id, body)
      log.info('KYC', 'phone otp sent', {
        userId: request.dbUser!.id,
        phone: body.phone.slice(0, 4) + '****' + body.phone.slice(-2),
      })
      reply.send(result)
    } catch (error) {
      handleRouteError(error, reply, 'KYC')
    }
  })

  app.post('/phone/verify', { preHandler: authChain }, async (request, reply) => {
    try {
      const body = parseBody(verifyPhoneOtpSchema, request.body)
      const user = await verifyPhoneOtp(request.dbUser!.id, body)
      log.info('KYC', 'phone verified', { userId: user.id })
      reply.send({ user: serializeUser(user) })
    } catch (error) {
      handleRouteError(error, reply, 'KYC')
    }
  })

  app.post('/identity', { preHandler: authChain }, async (request, reply) => {
    try {
      const body = parseBody(completeKycIdentitySchema, request.body)
      const user = await completeKycIdentity(request.dbUser!.id, body)
      log.info('KYC', 'identity completed', { userId: user.id })
      reply.send({ user: serializeUser(user) })
    } catch (error) {
      handleRouteError(error, reply, 'KYC')
    }
  })

  app.post('/card', { preHandler: authChain }, async (request, reply) => {
    try {
      const body = parseBody(saveKycCardSchema, request.body)
      const card = await saveKycBankCard(request.dbUser!.id, body)
      log.info('KYC', 'bank card saved', {
        userId: request.dbUser!.id,
        cardLast4: card.cardNumber.slice(-4),
        bankSlug: card.bankSlug,
      })
      reply.send({
        card: {
          id: card.id,
          cardNumber: card.cardNumber,
          bankName: card.bankName,
          bankSlug: card.bankSlug,
          bankBin: card.bankBin,
          isPrimary: card.isPrimary,
          isVerified: card.isVerified,
        },
      })
    } catch (error) {
      handleRouteError(error, reply, 'KYC')
    }
  })

  app.post('/terms/accept', { preHandler: authChain }, async (request, reply) => {
    try {
      const user = await acceptKycTerms(request.dbUser!.id)
      log.info('KYC', 'terms accepted', { userId: user.id })
      reply.send({ user: serializeUser(user) })
    } catch (error) {
      handleRouteError(error, reply, 'KYC')
    }
  })

  app.post('/verify/shahkar', { preHandler: authChain }, async (request, reply) => {
    try {
      const result = await verifyShahkarMatch(request.dbUser!.id)
      log.info('KYC', 'shahkar verified', {
        userId: request.dbUser!.id,
        cached: result.cached,
      })
      reply.send({
        matched: result.matched,
        cached: result.cached,
        user: serializeUser(result.user),
      })
    } catch (error) {
      handleRouteError(error, reply, 'KYC')
    }
  })

  app.post('/verify/card', { preHandler: authChain }, async (request, reply) => {
    try {
      const body = parseBody(verifyKycCardMatchSchema, request.body ?? {})
      const result = await verifyCardNationalMatch(request.dbUser!.id, body.cardNumber)
      log.info('KYC', 'card-national verified', {
        userId: request.dbUser!.id,
        cached: result.cached,
        cardId: result.cardId,
      })
      reply.send({
        matched: result.matched,
        cached: result.cached,
        user: serializeUser(result.user),
      })
    } catch (error) {
      handleRouteError(error, reply, 'KYC')
    }
  })
}
