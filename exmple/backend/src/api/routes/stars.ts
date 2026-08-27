import type { FastifyInstance, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { SwapWalletApiError } from '../../crypto-payments/swapwallet.client.js'
import { log } from '../../lib/logger.js'
import { telegramAuthMiddleware } from '../middleware/telegram-auth.js'
import { requireUserMiddleware } from '../middleware/require-user.js'
import {
  buyStars,
  buyStarsGiveaway,
  getStarsGiveawayPrice,
  MarketAppApiError,
  searchStarsGiveawayRecipient,
  searchStarsRecipient,
} from '../../stars/marketapp.client.js'
import { getStarsPriceQuote } from '../../stars/stars-price.service.js'
import {
  starsBuyBodySchema,
  starsGiveawayBuyBodySchema,
  starsPriceBodySchema,
  starsRecipientBodySchema,
} from '../../stars/stars.schema.js'
import { starsPurchaseBodySchema } from '../../stars/stars-purchase.schema.js'
import {
  createStarsCryptoPayment,
  createStarsGatewayPayment,
  purchaseStarsWithWallet,
  StarsPurchaseError,
} from '../../stars/stars-purchase.service.js'
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

  if (error instanceof StarsPurchaseError) {
    const status =
      error.code === 'INSUFFICIENT_BALANCE'
        ? 402
        : error.code === 'PRICE_CHANGED'
          ? 409
          : 400
    reply.code(status).send({ error: 'StarsPurchaseError', message: error.message, code: error.code })
    return
  }

  log.error(scope, error instanceof Error ? error.message : 'Unknown route error')
  reply.code(500).send({ error: 'InternalServerError', message: 'Unexpected server error' })
}

export async function starsRoutes(app: FastifyInstance): Promise<void> {
  const authChain = [telegramAuthMiddleware, requireUserMiddleware]

  app.post('/price', { preHandler: authChain }, async (request, reply) => {
    try {
      const body = starsPriceBodySchema.parse(request.body)
      const price = await getStarsPriceQuote(body.quantity)
      reply.send(price)
    } catch (error) {
      handleRouteError(error, reply, 'STARS')
    }
  })

  app.post('/recipient', { preHandler: authChain }, async (request, reply) => {
    try {
      const body = starsRecipientBodySchema.parse(request.body)
      const recipient = await searchStarsRecipient(body.username)
      reply.send({
        ...recipient,
        username: body.username,
      })
    } catch (error) {
      handleRouteError(error, reply, 'STARS')
    }
  })

  app.post('/buy', { preHandler: authChain }, async (request, reply) => {
    try {
      const body = starsBuyBodySchema.parse(request.body)
      const result = await buyStars(body)
      reply.send(result)
    } catch (error) {
      handleRouteError(error, reply, 'STARS')
    }
  })

  app.post('/purchase/wallet', { preHandler: authChain }, async (request, reply) => {
    try {
      const body = starsPurchaseBodySchema.parse(request.body)
      const result = await purchaseStarsWithWallet(request.dbUser!, body)
      reply.send(result)
    } catch (error) {
      handleRouteError(error, reply, 'STARS')
    }
  })

  app.post('/purchase/gateway', { preHandler: authChain }, async (request, reply) => {
    try {
      const body = starsPurchaseBodySchema.parse(request.body)
      const result = await createStarsGatewayPayment(request.dbUser!, body)
      reply.send(result)
    } catch (error) {
      handleRouteError(error, reply, 'STARS')
    }
  })

  app.post('/purchase/crypto', { preHandler: authChain }, async (request, reply) => {
    try {
      const body = starsPurchaseBodySchema.parse(request.body)
      const result = await createStarsCryptoPayment(request.dbUser!, body)
      reply.send(result)
    } catch (error) {
      handleRouteError(error, reply, 'STARS')
    }
  })

  app.post('/giveaway/price', { preHandler: authChain }, async (_request, reply) => {
    try {
      const price = await getStarsGiveawayPrice()
      reply.send(price)
    } catch (error) {
      handleRouteError(error, reply, 'STARS')
    }
  })

  app.post('/giveaway/recipient', { preHandler: authChain }, async (request, reply) => {
    try {
      const body = starsRecipientBodySchema.parse(request.body)
      const recipient = await searchStarsGiveawayRecipient(body.username)
      reply.send({
        ...recipient,
        username: body.username,
      })
    } catch (error) {
      handleRouteError(error, reply, 'STARS')
    }
  })

  app.post('/giveaway/buy', { preHandler: authChain }, async (request, reply) => {
    try {
      const body = starsGiveawayBuyBodySchema.parse(request.body)
      const result = await buyStarsGiveaway(body)
      reply.send(result)
    } catch (error) {
      handleRouteError(error, reply, 'STARS')
    }
  })
}
