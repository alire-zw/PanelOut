import type { FastifyInstance, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { env } from '../../config/env.js'
import { log } from '../../lib/logger.js'
import { telegramAuthMiddleware } from '../middleware/telegram-auth.js'
import { requireUserMiddleware } from '../middleware/require-user.js'
import { requireStaffMiddleware } from '../middleware/require-role.js'
import {
  callbackQuerySchema,
  createPaymentSchema,
  inquiryPaymentSchema,
  listPaymentsQuerySchema,
  verifyPaymentSchema,
} from '../../payments/payment.schema.js'
import {
  createPaymentRequest,
  getPaymentByOrderId,
  handlePaymentCallback,
  inquirePayment,
  listUserPayments,
  verifyPaymentForUser,
  ZibalApiError,
} from '../../payments/payment.service.js'
import { buildZibalPaymentUrl } from '../../payments/zibal.client.js'
import { serializePayment, serializePayments } from '../../payments/payment.serializer.js'
import { getOrderByPaymentId } from '../../orders/order.service.js'

async function buildMiniAppRedirect(
  status: 'success' | 'failed',
  payment?: { id: number; orderId: string },
  trackId?: string,
): Promise<string> {
  const base = env.MINI_APP_URL.replace(/\/$/, '')
  const linkedOrder = payment ? await getOrderByPaymentId(payment.id) : null
  const path =
    linkedOrder != null
      ? linkedOrder.category.slug === 'telegram-premium'
        ? status === 'success'
          ? '/premium/payment/success'
          : '/premium/payment/failed'
        : linkedOrder.category.slug === 'virtual-number'
          ? status === 'success'
            ? '/virtual-number/payment/success'
            : '/virtual-number/payment/failed'
          : linkedOrder.category.slug === 'reaction'
            ? status === 'success'
              ? '/reaction/payment/success'
              : '/reaction/payment/failed'
            : linkedOrder.category.slug === 'channel-views'
              ? status === 'success'
                ? '/channel-views/payment/success'
                : '/channel-views/payment/failed'
              : linkedOrder.category.slug === 'telegram-members'
                ? status === 'success'
                  ? '/telegram-members/payment/success'
                  : '/telegram-members/payment/failed'
                : linkedOrder.category.slug === 'chatgpt'
                  ? status === 'success'
                    ? '/chatgpt/payment/success'
                    : '/chatgpt/payment/failed'
                : status === 'success'
                  ? '/stars/payment/success'
                  : '/stars/payment/failed'
      : status === 'success'
        ? '/wallet/payment/success'
        : '/wallet/payment/failed'
  const params = new URLSearchParams()
  const orderId = linkedOrder?.orderId ?? payment?.orderId
  if (orderId) params.set('orderId', orderId)
  if (trackId) params.set('trackId', trackId)
  const query = params.toString()
  return `${base}${path}${query ? `?${query}` : ''}`
}

function handleRouteError(error: unknown, reply: FastifyReply, scope: string): void {
  if (error instanceof ZodError) {
    reply.code(400).send({
      error: 'ValidationError',
      message: 'Invalid request data',
      details: error.flatten(),
    })
    return
  }

  if (error instanceof ZibalApiError) {
    reply.code(502).send({
      error: 'PaymentGatewayError',
      message: error.message,
      resultCode: error.resultCode,
      phase: error.phase,
    })
    return
  }

  if (error instanceof Error) {
    if (error.message === 'Payment not found') {
      reply.code(404).send({ error: 'NotFound', message: error.message })
      return
    }

    if (error.message.startsWith('Minimum payment amount')) {
      reply.code(400).send({ error: 'BadRequest', message: error.message })
      return
    }
  }

  log.error(scope, error instanceof Error ? error.message : 'Unknown route error')
  reply.code(500).send({ error: 'InternalServerError', message: 'Unexpected server error' })
}

export async function paymentRoutes(app: FastifyInstance): Promise<void> {
  const authChain = [telegramAuthMiddleware, requireUserMiddleware]

  app.get('/callback', { config: { rateLimit: false } }, async (request, reply) => {
    try {
      const query = callbackQuerySchema.parse(request.query)
      const result = await handlePaymentCallback(query)

      const redirectUrl = await buildMiniAppRedirect(
        result.verified ? 'success' : 'failed',
        result.payment,
        query.trackId.toString(),
      )

      log.info('PAYMENT', 'callback handled', {
        orderId: result.payment.orderId,
        trackId: query.trackId.toString(),
        verified: result.verified,
      })

      reply.redirect(redirectUrl)
    } catch (error) {
      log.error('PAYMENT', 'callback failed', {
        error: error instanceof Error ? error.message : 'unknown',
      })
      reply.redirect(await buildMiniAppRedirect('failed'))
    }
  })

  app.post('/request', { preHandler: authChain }, async (request, reply) => {
    try {
      const body = createPaymentSchema.parse(request.body)
      const result = await createPaymentRequest(request.dbUser!, body)

      reply.code(201).send({
        payment: serializePayment(result.payment),
        paymentUrl: result.paymentUrl,
        trackId: result.trackId,
      })
    } catch (error) {
      handleRouteError(error, reply, 'PAYMENTS')
    }
  })

  app.post('/verify', { preHandler: authChain }, async (request, reply) => {
    try {
      const body = verifyPaymentSchema.parse(request.body)
      const result = await verifyPaymentForUser(request.dbUser!.id, body.trackId)

      reply.send({
        payment: serializePayment(result.payment),
        alreadyVerified: result.alreadyVerified,
      })
    } catch (error) {
      handleRouteError(error, reply, 'PAYMENTS')
    }
  })

  app.post('/inquiry', { preHandler: [...authChain, requireStaffMiddleware] }, async (request, reply) => {
    try {
      const body = inquiryPaymentSchema.parse(request.body)
      const result = await inquirePayment(body.trackId)

      reply.send({
        payment: result.payment ? serializePayment(result.payment) : null,
        inquiry: result.inquiry,
      })
    } catch (error) {
      handleRouteError(error, reply, 'PAYMENTS')
    }
  })

  app.get('/me', { preHandler: authChain }, async (request, reply) => {
    try {
      const query = listPaymentsQuerySchema.parse(request.query)
      const result = await listUserPayments(request.dbUser!.id, query)

      reply.send({
        ...result,
        items: serializePayments(result.items),
      })
    } catch (error) {
      handleRouteError(error, reply, 'PAYMENTS')
    }
  })

  app.get('/order/:orderId', { preHandler: authChain }, async (request, reply) => {
    try {
      const params = request.params as { orderId: string }
      const payment = await getPaymentByOrderId(params.orderId, request.dbUser!.id)

      if (!payment) {
        reply.code(404).send({ error: 'NotFound', message: 'Payment not found' })
        return
      }

      reply.send({
        payment: serializePayment(payment),
        paymentUrl:
          payment.status === 'pending' && payment.trackId
            ? buildZibalPaymentUrl(payment.trackId)
            : null,
      })
    } catch (error) {
      handleRouteError(error, reply, 'PAYMENTS')
    }
  })
}
