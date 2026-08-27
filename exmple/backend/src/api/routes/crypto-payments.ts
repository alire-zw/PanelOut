import type { FastifyInstance, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { log } from '../../lib/logger.js'
import { telegramAuthMiddleware } from '../middleware/telegram-auth.js'
import { requireUserMiddleware } from '../middleware/require-user.js'
import { createCryptoPaymentSchema, listCryptoPaymentsQuerySchema } from '../../crypto-payments/crypto-payment.schema.js'
import {
  createCryptoPayment,
  getCryptoPaymentByOrderId,
  getCurrentTrxPrice,
  listUserCryptoPayments,
  SwapWalletApiError,
} from '../../crypto-payments/crypto-payment.service.js'
import { serializeCryptoPayment } from '../../crypto-payments/crypto-payment.serializer.js'
import { notifyCryptoPaymentInvoiceCreated } from '../../bot/notifications/crypto-payment-invoice.js'
import { getOrderByCryptoPaymentId } from '../../orders/order.service.js'

function handleRouteError(error: unknown, reply: FastifyReply, scope: string): void {
  if (error instanceof ZodError) {
    reply.code(400).send({
      error: 'ValidationError',
      message: 'Invalid request data',
      details: error.flatten(),
    })
    return
  }

  if (error instanceof SwapWalletApiError) {
    reply.code(502).send({ error: 'SwapWalletError', message: error.message })
    return
  }

  if (error instanceof Error) {
    if (error.message === 'Payment not found') {
      reply.code(404).send({ error: 'NotFound', message: error.message })
      return
    }

    if (
      error.message.startsWith('Minimum crypto payment amount') ||
      error.message.startsWith('You already have an active crypto payment')
    ) {
      reply.code(400).send({ error: 'BadRequest', message: error.message })
      return
    }
  }

  log.error(scope, error instanceof Error ? error.message : 'Unknown route error')
  reply.code(500).send({ error: 'InternalServerError', message: 'Unexpected server error' })
}

export async function cryptoPaymentRoutes(app: FastifyInstance): Promise<void> {
  const authChain = [telegramAuthMiddleware, requireUserMiddleware]

  app.get('/price', { preHandler: authChain }, async (_request, reply) => {
    try {
      const price = await getCurrentTrxPrice()
      reply.send(price)
    } catch (error) {
      handleRouteError(error, reply, 'CRYPTO')
    }
  })

  app.post('/request', { preHandler: authChain }, async (request, reply) => {
    try {
      const body = createCryptoPaymentSchema.parse(request.body)
      const result = await createCryptoPayment(request.dbUser!, body)

      void notifyCryptoPaymentInvoiceCreated({
        paymentId: result.payment.id,
        telegramId: request.dbUser!.telegramId,
        amountToman: body.amount,
        amountTrx: result.payment.amountTrx,
        orderId: result.payment.orderId,
      })

      reply.code(201).send({
        payment: serializeCryptoPayment(result.payment, result.wallet.address),
        expiresInMinutes: 10,
      })
    } catch (error) {
      handleRouteError(error, reply, 'CRYPTO')
    }
  })

  app.get('/me', { preHandler: authChain }, async (request, reply) => {
    try {
      const query = listCryptoPaymentsQuerySchema.parse(request.query)
      const result = await listUserCryptoPayments(request.dbUser!.id, query)

      reply.send({
        ...result,
        items: result.items.map((item) => serializeCryptoPayment(item, item.wallet.address)),
      })
    } catch (error) {
      handleRouteError(error, reply, 'CRYPTO')
    }
  })

  app.get('/order/:orderId', { preHandler: authChain }, async (request, reply) => {
    try {
      const params = request.params as { orderId: string }
      const payment = await getCryptoPaymentByOrderId(params.orderId, request.dbUser!.id)

      if (!payment) {
        reply.code(404).send({ error: 'NotFound', message: 'Payment not found' })
        return
      }

      const linkedOrder = await getOrderByCryptoPaymentId(payment.id)

      reply.send({
        payment: serializeCryptoPayment(payment, payment.wallet.address, linkedOrder?.orderId ?? null),
      })
    } catch (error) {
      handleRouteError(error, reply, 'CRYPTO')
    }
  })
}
