import type { FastifyInstance } from 'fastify'
import { ZodError } from 'zod'
import { env } from '../../config/env.js'
import {
  BrowserAuthError,
  sendBrowserLoginOtp,
  verifyBrowserLoginOtp,
} from '../../auth/browser-otp.service.js'
import { sendPhoneOtpSchema, verifyPhoneOtpSchema } from '../../kyc/kyc.schema.js'
import { serializeUser } from '../../users/user.serializer.js'
import { telegramAuthMiddleware } from '../middleware/telegram-auth.js'
import { requireUserMiddleware } from '../middleware/require-user.js'

const authChain = [telegramAuthMiddleware, requireUserMiddleware]

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.get('/me', { preHandler: authChain }, async (request, reply) => {
    reply.send({ user: serializeUser(request.dbUser!) })
  })

  app.get('/browser/status', async (_request, reply) => {
    reply.send({
      enabled: Boolean(env.BROWSER_PUBLIC_MODE),
      otpLength: 5,
    })
  })

  app.post('/browser/otp/send', async (request, reply) => {
    try {
      const body = sendPhoneOtpSchema.parse(request.body)
      const result = await sendBrowserLoginOtp({
        phone: body.phone,
        ip: request.ip,
      })
      reply.send(result)
    } catch (error) {
      handleBrowserAuthError(error, reply)
    }
  })

  app.post('/browser/otp/verify', async (request, reply) => {
    try {
      const body = verifyPhoneOtpSchema.parse(request.body)
      const { user, session } = await verifyBrowserLoginOtp(body)
      reply.send({
        token: session.token,
        expiresAt: session.expiresAt,
        expiresInSeconds: session.expiresInSeconds,
        user: serializeUser(user),
      })
    } catch (error) {
      handleBrowserAuthError(error, reply)
    }
  })
}

function handleBrowserAuthError(error: unknown, reply: import('fastify').FastifyReply) {
  if (error instanceof ZodError) {
    reply.code(400).send({
      error: 'ValidationError',
      message: error.issues[0]?.message ?? 'ورودی نامعتبر است',
    })
    return
  }

  if (error instanceof BrowserAuthError) {
    const status =
      error.code === 'DISABLED'
        ? 403
        : error.code === 'COOLDOWN' || error.code === 'RATE_LIMIT'
          ? 429
          : error.code === 'SMS_FAILED'
            ? 502
            : 400

    reply.code(status).send({
      error: error.code,
      message: error.message,
      ...(error.retryAfterSeconds != null
        ? { retryAfterSeconds: error.retryAfterSeconds }
        : {}),
    })
    return
  }

  reply.code(500).send({
    error: 'InternalError',
    message: error instanceof Error ? error.message : 'خطای داخلی',
  })
}
