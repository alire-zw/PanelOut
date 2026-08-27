import type { FastifyInstance, FastifyReply } from 'fastify'
import { z, ZodError } from 'zod'
import { log } from '../../lib/logger.js'
import { telegramAuthMiddleware } from '../middleware/telegram-auth.js'
import { requireUserMiddleware } from '../middleware/require-user.js'
import {
  fetchTelegramMembersChannelPreview,
  TelegramMembersChannelPreviewError,
} from '../../telegram-members/telegram-members-channel-preview.service.js'
import { telegramMembersPurchaseBodySchema } from '../../telegram-members/telegram-members.schema.js'
import {
  TelegramMembersPurchaseError,
  createTelegramMembersGatewayPayment,
  purchaseTelegramMembersWithWallet,
} from '../../telegram-members/telegram-members-purchase.service.js'
const channelPreviewBodySchema = z.object({
  link: z.string().trim().min(1).max(512),
})

function handleRouteError(error: unknown, reply: FastifyReply, scope: string): void {
  if (error instanceof ZodError) {
    reply.code(400).send({
      error: 'ValidationError',
      message: 'Invalid request data',
      details: error.flatten(),
    })
    return
  }

  if (error instanceof TelegramMembersChannelPreviewError) {
    const status =
      error.code === 'NOT_FOUND'
        ? 404
        : error.code === 'FETCH_FAILED'
          ? 502
          : 400
    reply.code(status).send({
      error: 'TelegramMembersChannelPreviewError',
      message: error.message,
      code: error.code,
    })
    return
  }

  if (error instanceof TelegramMembersPurchaseError) {
    const status =
      error.code === 'INSUFFICIENT_BALANCE'
        ? 402
        : error.code === 'PRICE_CHANGED' ||
            error.code === 'INVALID_QUANTITY' ||
            error.code === 'INVALID_SERVICE'
          ? 400
          : error.code === 'SERVICE_UNAVAILABLE'
            ? 503
            : 502
    reply.code(status).send({
      error: 'TelegramMembersPurchaseError',
      message: error.message,
      code: error.code,
    })
    return
  }

  log.error(scope, error instanceof Error ? error.message : 'Unknown route error')
  reply.code(500).send({ error: 'InternalServerError', message: 'Unexpected server error' })
}

export async function telegramMembersRoutes(app: FastifyInstance): Promise<void> {
  const authChain = [telegramAuthMiddleware, requireUserMiddleware]

  app.post('/channel-preview', { preHandler: authChain }, async (request, reply) => {
    try {
      const body = channelPreviewBodySchema.parse(request.body)
      const preview = await fetchTelegramMembersChannelPreview(body.link)
      reply.send(preview)
    } catch (error) {
      handleRouteError(error, reply, 'POST /telegram-members/channel-preview')
    }
  })

  app.post('/purchase/wallet', { preHandler: authChain }, async (request, reply) => {
    try {
      const body = telegramMembersPurchaseBodySchema.parse(request.body)
      const result = await purchaseTelegramMembersWithWallet(request.dbUser!, body)
      reply.send(result)
    } catch (error) {
      handleRouteError(error, reply, 'POST /telegram-members/purchase/wallet')
    }
  })

  app.post('/purchase/gateway', { preHandler: authChain }, async (request, reply) => {
    try {
      const body = telegramMembersPurchaseBodySchema.parse(request.body)
      const result = await createTelegramMembersGatewayPayment(request.dbUser!, body)
      reply.send(result)
    } catch (error) {
      handleRouteError(error, reply, 'POST /telegram-members/purchase/gateway')
    }
  })
}
