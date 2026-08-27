import type { FastifyInstance, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { log } from '../../lib/logger.js'
import {
  fetchReactionPostPreview,
  ReactionPostPreviewError,
} from '../../reaction/reaction-post-preview.service.js'
import {
  AutoReactionError,
  configureAutoReactionChannel,
  deactivateAutoReactionChannel,
  deleteAutoReactionChannel,
  getAutoReactionBotInfo,
  listAutoReactionChannels,
  registerAutoReactionChannel,
} from '../../reaction/auto-reaction.service.js'
import {
  autoReactionConfigureBodySchema,
  autoReactionRegisterBodySchema,
  reactionPostPreviewBodySchema,
  reactionPurchaseBodySchema,
} from '../../reaction/reaction.schema.js'
import {
  createReactionGatewayPayment,
  purchaseReactionWithWallet,
  ReactionPurchaseError,
} from '../../reaction/reaction-purchase.service.js'
import { PowerTelApiError } from '../../reaction/powertel.client.js'
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

  if (error instanceof ReactionPostPreviewError) {
    const status =
      error.code === 'NOT_FOUND'
        ? 404
        : error.code === 'FETCH_FAILED'
          ? 502
          : 400
    reply.code(status).send({
      error: 'ReactionPostPreviewError',
      message: error.message,
      code: error.code,
    })
    return
  }

  if (error instanceof AutoReactionError) {
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
      error: 'AutoReactionError',
      message: error.message,
      code: error.code,
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

  if (error instanceof ReactionPurchaseError) {
    const status =
      error.code === 'INSUFFICIENT_BALANCE'
        ? 402
        : error.code === 'PRICE_CHANGED' ||
            error.code === 'SERVICE_UNAVAILABLE' ||
            error.code === 'INVALID_QUANTITY'
          ? 409
          : 400
    reply.code(status).send({
      error: 'ReactionPurchaseError',
      message: error.message,
      code: error.code,
    })
    return
  }

  log.error(scope, error instanceof Error ? error.message : 'Unknown route error')
  reply.code(500).send({ error: 'InternalServerError', message: 'Unexpected server error' })
}

export async function reactionRoutes(app: FastifyInstance): Promise<void> {
  const authChain = [telegramAuthMiddleware, requireUserMiddleware]

  app.post('/post-preview', { preHandler: authChain }, async (request, reply) => {
    try {
      const body = reactionPostPreviewBodySchema.parse(request.body)
      const preview = await fetchReactionPostPreview(body.link)
      reply.send(preview)
    } catch (error) {
      handleRouteError(error, reply, 'POST /reaction/post-preview')
    }
  })

  app.post('/purchase/wallet', { preHandler: authChain }, async (request, reply) => {
    try {
      const body = reactionPurchaseBodySchema.parse(request.body)
      const result = await purchaseReactionWithWallet(request.dbUser!, body)
      reply.send(result)
    } catch (error) {
      handleRouteError(error, reply, 'POST /reaction/purchase/wallet')
    }
  })

  app.post('/purchase/gateway', { preHandler: authChain }, async (request, reply) => {
    try {
      const body = reactionPurchaseBodySchema.parse(request.body)
      const result = await createReactionGatewayPayment(request.dbUser!, body)
      reply.send(result)
    } catch (error) {
      handleRouteError(error, reply, 'POST /reaction/purchase/gateway')
    }
  })

  app.get('/auto/bot', { preHandler: authChain }, async (_request, reply) => {
    try {
      const info = await getAutoReactionBotInfo()
      reply.send(info)
    } catch (error) {
      handleRouteError(error, reply, 'GET /reaction/auto/bot')
    }
  })

  app.get('/auto/channels', { preHandler: authChain }, async (request, reply) => {
    try {
      const channels = await listAutoReactionChannels(request.dbUser!.id)
      reply.send({ channels })
    } catch (error) {
      handleRouteError(error, reply, 'GET /reaction/auto/channels')
    }
  })

  app.post('/auto/channels', { preHandler: authChain }, async (request, reply) => {
    try {
      const body = autoReactionRegisterBodySchema.parse(request.body)
      const channel = await registerAutoReactionChannel(request.dbUser!, body.link)
      reply.send({ channel })
    } catch (error) {
      handleRouteError(error, reply, 'POST /reaction/auto/channels')
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

      const body = autoReactionConfigureBodySchema.parse(request.body)
      const channel = await configureAutoReactionChannel(request.dbUser!.id, channelId, body)
      reply.send({ channel })
    } catch (error) {
      handleRouteError(error, reply, 'PUT /reaction/auto/channels/:id')
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

      const channel = await deactivateAutoReactionChannel(request.dbUser!.id, channelId)
      reply.send({ channel })
    } catch (error) {
      handleRouteError(error, reply, 'POST /reaction/auto/channels/:id/deactivate')
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

      const result = await deleteAutoReactionChannel(request.dbUser!.id, channelId)
      reply.send(result)
    } catch (error) {
      handleRouteError(error, reply, 'DELETE /reaction/auto/channels/:id')
    }
  })
}
