import type { FastifyInstance, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { log } from '../../lib/logger.js'
import { PowerTelApiError } from '../../reaction/powertel.client.js'
import { telegramAuthMiddleware } from '../middleware/telegram-auth.js'
import { requireUserMiddleware } from '../middleware/require-user.js'
import { channelViewsPurchaseBodySchema } from '../../channel-views/channel-views.schema.js'
import {
  ChannelViewsPurchaseError,
  createChannelViewsGatewayPayment,
  purchaseChannelViewsWithWallet,
} from '../../channel-views/channel-views-purchase.service.js'
import {
  autoChannelViewsConfigureBodySchema,
  autoChannelViewsRegisterBodySchema,
} from '../../channel-views/auto-channel-views.schema.js'
import {
  AutoChannelViewsError,
  configureAutoChannelViewChannel,
  deactivateAutoChannelViewChannel,
  deleteAutoChannelViewChannel,
  getAutoChannelViewsBotInfo,
  listAutoChannelViewChannels,
  registerAutoChannelViewChannel,
} from '../../channel-views/auto-channel-views.service.js'
function handleRouteError(error: unknown, reply: FastifyReply, scope: string): void {
  if (error instanceof ZodError) {
    reply.code(400).send({
      error: 'ValidationError',
      message: 'Invalid request data',
      details: error.flatten(),
    })
    return
  }

  if (error instanceof PowerTelApiError) {
    reply.code(error.status >= 400 && error.status < 600 ? error.status : 502).send({
      error: 'PowerTelError',
      message: error.message,
      details: error.details,
    })
    return
  }

  if (error instanceof ChannelViewsPurchaseError) {
    const status =
      error.code === 'INSUFFICIENT_BALANCE'
        ? 402
        : error.code === 'PRICE_CHANGED' ||
            error.code === 'SERVICE_UNAVAILABLE' ||
            error.code === 'INVALID_QUANTITY' ||
            error.code === 'INVALID_SERVICE'
          ? 409
          : 400
    reply.code(status).send({
      error: 'ChannelViewsPurchaseError',
      message: error.message,
      code: error.code,
    })
    return
  }

  if (error instanceof AutoChannelViewsError) {
    const status =
      error.code === 'NOT_FOUND'
        ? 404
        : error.code === 'BOT_NOT_ADMIN' ||
            error.code === 'USER_NOT_ADMIN' ||
            error.code === 'CHANNEL_UNAVAILABLE' ||
            error.code === 'PRIVATE_CHANNEL'
          ? 409
          : 400
    reply.code(status).send({
      error: 'AutoChannelViewsError',
      message: error.message,
      code: error.code,
    })
    return
  }

  log.error(scope, error instanceof Error ? error.message : 'Unknown route error')
  reply.code(500).send({ error: 'InternalServerError', message: 'Unexpected server error' })
}

export async function channelViewsRoutes(app: FastifyInstance): Promise<void> {
  const authChain = [telegramAuthMiddleware, requireUserMiddleware]

  app.get('/catalog', { preHandler: authChain }, async (_request, reply) => {
    reply.send({ productKey: 'channel-views' })
  })

  app.post('/purchase/wallet', { preHandler: authChain }, async (request, reply) => {
    try {
      const body = channelViewsPurchaseBodySchema.parse(request.body)
      const result = await purchaseChannelViewsWithWallet(request.dbUser!, body)
      reply.send(result)
    } catch (error) {
      handleRouteError(error, reply, 'POST /channel-views/purchase/wallet')
    }
  })

  app.post('/purchase/gateway', { preHandler: authChain }, async (request, reply) => {
    try {
      const body = channelViewsPurchaseBodySchema.parse(request.body)
      const result = await createChannelViewsGatewayPayment(request.dbUser!, body)
      reply.send(result)
    } catch (error) {
      handleRouteError(error, reply, 'POST /channel-views/purchase/gateway')
    }
  })

  app.get('/auto/bot', { preHandler: authChain }, async (_request, reply) => {
    try {
      const info = await getAutoChannelViewsBotInfo()
      reply.send(info)
    } catch (error) {
      handleRouteError(error, reply, 'GET /channel-views/auto/bot')
    }
  })

  app.get('/auto/channels', { preHandler: authChain }, async (request, reply) => {
    try {
      const channels = await listAutoChannelViewChannels(request.dbUser!.id)
      reply.send({ channels })
    } catch (error) {
      handleRouteError(error, reply, 'GET /channel-views/auto/channels')
    }
  })

  app.post('/auto/channels', { preHandler: authChain }, async (request, reply) => {
    try {
      const body = autoChannelViewsRegisterBodySchema.parse(request.body)
      const channel = await registerAutoChannelViewChannel(request.dbUser!, body.link)
      reply.send({ channel })
    } catch (error) {
      handleRouteError(error, reply, 'POST /channel-views/auto/channels')
    }
  })

  app.put('/auto/channels/:id', { preHandler: authChain }, async (request, reply) => {
    try {
      const params = request.params as { id: string }
      const channelId = Number.parseInt(params.id, 10)
      if (!Number.isFinite(channelId) || channelId <= 0) {
        reply.code(400).send({ error: 'ValidationError', message: 'Invalid channel id' })
        return
      }

      const body = autoChannelViewsConfigureBodySchema.parse(request.body)
      const channel = await configureAutoChannelViewChannel(
        request.dbUser!.id,
        channelId,
        body,
      )
      reply.send({ channel })
    } catch (error) {
      handleRouteError(error, reply, 'PUT /channel-views/auto/channels/:id')
    }
  })

  app.post('/auto/channels/:id/deactivate', { preHandler: authChain }, async (request, reply) => {
    try {
      const params = request.params as { id: string }
      const channelId = Number.parseInt(params.id, 10)
      if (!Number.isFinite(channelId) || channelId <= 0) {
        reply.code(400).send({ error: 'ValidationError', message: 'Invalid channel id' })
        return
      }

      const channel = await deactivateAutoChannelViewChannel(request.dbUser!.id, channelId)
      reply.send({ channel })
    } catch (error) {
      handleRouteError(error, reply, 'POST /channel-views/auto/channels/:id/deactivate')
    }
  })

  app.delete('/auto/channels/:id', { preHandler: authChain }, async (request, reply) => {
    try {
      const params = request.params as { id: string }
      const channelId = Number.parseInt(params.id, 10)
      if (!Number.isFinite(channelId) || channelId <= 0) {
        reply.code(400).send({ error: 'ValidationError', message: 'Invalid channel id' })
        return
      }

      const result = await deleteAutoChannelViewChannel(request.dbUser!.id, channelId)
      reply.send(result)
    } catch (error) {
      handleRouteError(error, reply, 'DELETE /channel-views/auto/channels/:id')
    }
  })
}
