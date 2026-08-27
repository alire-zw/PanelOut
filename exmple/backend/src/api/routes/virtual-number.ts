import type { FastifyInstance, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { log } from '../../lib/logger.js'
import { CallinooApiError } from '../../virtual-number/callinoo.client.js'
import { getVirtualNumberCountryGroups } from '../../virtual-number/virtual-number-countries.service.js'
import {
  virtualNumberCountriesQuerySchema,
  virtualNumberPurchaseBodySchema,
} from '../../virtual-number/virtual-number.schema.js'
import {
  createVirtualNumberGatewayPayment,
  purchaseVirtualNumberWithWallet,
  VirtualNumberPurchaseError,
} from '../../virtual-number/virtual-number-purchase.service.js'
import {
  getVirtualNumberVerificationCode,
  logoutVirtualNumberTelegramAccount,
} from '../../virtual-number/virtual-number-code.service.js'
import { telegramAuthMiddleware } from '../middleware/telegram-auth.js'
import { requireUserMiddleware } from '../middleware/require-user.js'
function handleRouteError(error: unknown, reply: FastifyReply, scope: string): void {
  if (error instanceof ZodError) {
    reply.code(400).send({
      error: 'ValidationError',
      message: 'Invalid request data',
      details: error.flatten(),
    })
    return
  }

  if (error instanceof CallinooApiError) {
    reply.code(error.status >= 400 && error.status < 600 ? error.status : 502).send({
      error: 'CallinooError',
      message: error.message,
      details: error.details,
    })
    return
  }

  if (error instanceof VirtualNumberPurchaseError) {
    const status =
      error.code === 'INSUFFICIENT_BALANCE'
        ? 402
        : error.code === 'PRICE_CHANGED' || error.code === 'COUNTRY_UNAVAILABLE'
          ? 409
          : 400
    reply.code(status).send({
      error: 'VirtualNumberPurchaseError',
      message: error.message,
      code: error.code,
    })
    return
  }

  log.error(scope, error instanceof Error ? error.message : 'Unknown route error')
  reply.code(500).send({ error: 'InternalError', message: 'Something went wrong' })
}

export async function virtualNumberRoutes(app: FastifyInstance): Promise<void> {
  const authChain = [telegramAuthMiddleware, requireUserMiddleware]

  app.get('/countries', { preHandler: authChain }, async (request, reply) => {
    try {
      const query = virtualNumberCountriesQuerySchema.parse(request.query)
      const { groups, cached } = await getVirtualNumberCountryGroups(query.none_report)

      log.debug('HTTP', 'virtual number countries served', {
        cached,
        groups: groups.length,
        countries: groups.reduce((sum, group) => sum + group.items.length, 0),
      })

      reply.send({ groups, cached })
    } catch (error) {
      handleRouteError(error, reply, 'GET /virtual-number/countries')
    }
  })

  app.post('/purchase/wallet', { preHandler: authChain }, async (request, reply) => {
    try {
      const body = virtualNumberPurchaseBodySchema.parse(request.body)
      const result = await purchaseVirtualNumberWithWallet(request.dbUser!, body)
      reply.send(result)
    } catch (error) {
      handleRouteError(error, reply, 'POST /virtual-number/purchase/wallet')
    }
  })

  app.post('/purchase/gateway', { preHandler: authChain }, async (request, reply) => {
    try {
      const body = virtualNumberPurchaseBodySchema.parse(request.body)
      const result = await createVirtualNumberGatewayPayment(request.dbUser!, body)
      reply.send(result)
    } catch (error) {
      handleRouteError(error, reply, 'POST /virtual-number/purchase/gateway')
    }
  })

  app.post('/orders/:orderId/code', { preHandler: authChain }, async (request, reply) => {
    try {
      const params = request.params as { orderId: string }
      const result = await getVirtualNumberVerificationCode(request.dbUser!.id, params.orderId)
      reply.send(result)
    } catch (error) {
      handleRouteError(error, reply, 'POST /virtual-number/orders/:orderId/code')
    }
  })

  app.post('/orders/:orderId/logout', { preHandler: authChain }, async (request, reply) => {
    try {
      const params = request.params as { orderId: string }
      const result = await logoutVirtualNumberTelegramAccount(request.dbUser!.id, params.orderId)
      reply.send(result)
    } catch (error) {
      handleRouteError(error, reply, 'POST /virtual-number/orders/:orderId/logout')
    }
  })
}
