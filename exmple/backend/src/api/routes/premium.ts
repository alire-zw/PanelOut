import type { FastifyInstance, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { SwapWalletApiError } from '../../crypto-payments/swapwallet.client.js'
import { log } from '../../lib/logger.js'
import { telegramAuthMiddleware } from '../middleware/telegram-auth.js'
import { requireUserMiddleware } from '../middleware/require-user.js'
import {
  premiumPriceBodySchema,
  premiumPurchaseBodySchema,
  premiumRecipientBodySchema,
} from '../../premium/premium.schema.js'
import { getAllPremiumPriceQuotes, getPremiumPriceQuote } from '../../premium/premium-price.service.js'
import {
  createPremiumCryptoPayment,
  createPremiumGatewayPayment,
  purchasePremiumWithWallet,
  PremiumPurchaseError,
} from '../../premium/premium-purchase.service.js'
import { MarketAppApiError, searchPremiumRecipient } from '../../stars/marketapp.client.js'
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

  if (error instanceof MarketAppApiError) {
    reply.code(error.status >= 400 && error.status < 600 ? error.status : 502).send({
      error: 'MarketAppError',
      message: error.message,
      details: error.details,
    })
    return
  }

  if (error instanceof PremiumPurchaseError) {
    const status =
      error.code === 'INSUFFICIENT_BALANCE'
        ? 402
        : error.code === 'PRICE_CHANGED'
          ? 409
          : 400
    reply.code(status).send({ error: 'PremiumPurchaseError', message: error.message, code: error.code })
    return
  }

  log.error(scope, error instanceof Error ? error.message : 'Unknown route error')
  reply.code(500).send({ error: 'InternalServerError', message: 'Unexpected server error' })
}

export async function premiumRoutes(app: FastifyInstance): Promise<void> {
  const authChain = [telegramAuthMiddleware, requireUserMiddleware]

  app.get('/prices', { preHandler: authChain }, async (request, reply) => {
    try {
      const items = await getAllPremiumPriceQuotes()
      reply.send({ items })
    } catch (error) {
      handleRouteError(error, reply, 'PREMIUM')
    }
  })

  app.post('/price', { preHandler: authChain }, async (request, reply) => {
    try {
      const body = premiumPriceBodySchema.parse(request.body)
      const price = await getPremiumPriceQuote(body.months)
      reply.send(price)
    } catch (error) {
      handleRouteError(error, reply, 'PREMIUM')
    }
  })

  app.post('/recipient', { preHandler: authChain }, async (request, reply) => {
    try {
      const body = premiumRecipientBodySchema.parse(request.body)
      const recipient = await searchPremiumRecipient(body.username, body.months)
      reply.send({
        ...recipient,
        username: body.username,
      })
    } catch (error) {
      handleRouteError(error, reply, 'PREMIUM')
    }
  })

  app.post('/purchase/wallet', { preHandler: authChain }, async (request, reply) => {
    try {
      const body = premiumPurchaseBodySchema.parse(request.body)
      const result = await purchasePremiumWithWallet(request.dbUser!, body)
      reply.send(result)
    } catch (error) {
      handleRouteError(error, reply, 'PREMIUM')
    }
  })

  app.post('/purchase/gateway', { preHandler: authChain }, async (request, reply) => {
    try {
      const body = premiumPurchaseBodySchema.parse(request.body)
      const result = await createPremiumGatewayPayment(request.dbUser!, body)
      reply.send(result)
    } catch (error) {
      handleRouteError(error, reply, 'PREMIUM')
    }
  })

  app.post('/purchase/crypto', { preHandler: authChain }, async (request, reply) => {
    try {
      const body = premiumPurchaseBodySchema.parse(request.body)
      const result = await createPremiumCryptoPayment(request.dbUser!, body)
      reply.send(result)
    } catch (error) {
      handleRouteError(error, reply, 'PREMIUM')
    }
  })
}
