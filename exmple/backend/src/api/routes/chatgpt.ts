import type { FastifyInstance, FastifyReply } from 'fastify'
import { z, ZodError } from 'zod'
import { log } from '../../lib/logger.js'
import { telegramAuthMiddleware } from '../middleware/telegram-auth.js'
import { requireUserMiddleware } from '../middleware/require-user.js'
import { SwapWalletApiError } from '../../crypto-payments/swapwallet.client.js'
import { isAccountShopCategoryId } from '../../chatgpt/account-shop.catalog.js'
import { getAccountShopPlansCatalog } from '../../chatgpt/account-shop-plans.catalog.service.js'
import { accountShopPurchaseBodySchema } from '../../chatgpt/account-shop-purchase.schema.js'
import {
  AccountShopPurchaseError,
  createAccountShopGatewayPayment,
  purchaseAccountShopWithWallet,
} from '../../chatgpt/account-shop-purchase.service.js'
import { RoboticvnApiError } from '../../roboticvn/roboticvn.client.js'

function handleRouteError(error: unknown, reply: FastifyReply, scope: string): void {
  if (error instanceof ZodError) {
    reply.code(400).send({
      error: 'ValidationError',
      message: 'Invalid request data',
      details: error.flatten(),
    })
    return
  }

  if (error instanceof AccountShopPurchaseError) {
    const status =
      error.code === 'INSUFFICIENT_BALANCE'
        ? 402
        : error.code === 'PRICE_CHANGED' ||
            error.code === 'INVALID_FIELDS' ||
            error.code === 'PLAN_NOT_FOUND' ||
            error.code === 'OUT_OF_STOCK'
          ? 400
          : error.code === 'PLAN_UNAVAILABLE'
            ? 503
            : 502
    reply.code(status).send({
      error: 'AccountShopPurchaseError',
      message: error.message,
      code: error.code,
    })
    return
  }

  if (error instanceof RoboticvnApiError) {
    reply.code(error.status >= 400 && error.status < 600 ? error.status : 502).send({
      error: 'RoboticvnApiError',
      message: error.message,
    })
    return
  }

  if (error instanceof SwapWalletApiError) {
    reply.code(502).send({
      error: 'SwapWalletApiError',
      message: error.message,
    })
    return
  }

  log.error(scope, error instanceof Error ? error.message : 'Unknown route error')
  reply.code(500).send({ error: 'InternalServerError', message: 'Unexpected server error' })
}

export async function chatgptRoutes(app: FastifyInstance): Promise<void> {
  const authChain = [telegramAuthMiddleware, requireUserMiddleware]

  app.get('/products', { preHandler: authChain }, async (request, reply) => {
    try {
      const query = z
        .object({
          categoryId: z.string().trim().optional(),
        })
        .parse(request.query)

      const categoryId =
        query.categoryId && isAccountShopCategoryId(query.categoryId)
          ? query.categoryId
          : undefined

      const catalog = await getAccountShopPlansCatalog(categoryId)
      reply.send(catalog)
    } catch (error) {
      handleRouteError(error, reply, 'GET /chatgpt/products')
    }
  })

  app.post('/purchase/wallet', { preHandler: authChain }, async (request, reply) => {
    try {
      const body = accountShopPurchaseBodySchema.parse(request.body)
      const result = await purchaseAccountShopWithWallet(request.dbUser!, body)
      reply.send(result)
    } catch (error) {
      handleRouteError(error, reply, 'POST /chatgpt/purchase/wallet')
    }
  })

  app.post('/purchase/gateway', { preHandler: authChain }, async (request, reply) => {
    try {
      const body = accountShopPurchaseBodySchema.parse(request.body)
      const result = await createAccountShopGatewayPayment(request.dbUser!, body)
      reply.send(result)
    } catch (error) {
      handleRouteError(error, reply, 'POST /chatgpt/purchase/gateway')
    }
  })
}
