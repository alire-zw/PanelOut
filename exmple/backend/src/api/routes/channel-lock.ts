import type { FastifyInstance, FastifyReply } from 'fastify'
import { z, ZodError } from 'zod'
import {
  checkChannelLockMembership,
  getChannelLockStatus,
} from '../../channel-lock/channel-lock.service.js'
import { CHANNEL_LOCK_SLOTS } from '../../admin/admin-system-channels.schema.js'
import { log } from '../../lib/logger.js'
import { requireUserMiddleware } from '../middleware/require-user.js'
import { telegramAuthMiddleware } from '../middleware/telegram-auth.js'

function handleRouteError(error: unknown, reply: FastifyReply, scope: string): void {
  if (error instanceof ZodError) {
    reply.code(400).send({
      error: 'ValidationError',
      message: 'Invalid request data',
      details: error.flatten(),
    })
    return
  }

  log.error(scope, error instanceof Error ? error.message : 'Unknown route error')
  reply.code(500).send({ error: 'InternalServerError', message: 'Unexpected server error' })
}

const slotParamSchema = z.object({
  slotKey: z.enum(CHANNEL_LOCK_SLOTS),
})

export async function channelLockRoutes(app: FastifyInstance): Promise<void> {
  const authChain = [telegramAuthMiddleware, requireUserMiddleware]

  app.get('/status', { preHandler: authChain }, async (request, reply) => {
    try {
      reply.send(await getChannelLockStatus(request.dbUser!))
    } catch (error) {
      handleRouteError(error, reply, 'CHANNEL_LOCK')
    }
  })

  app.get('/check/:slotKey', { preHandler: authChain }, async (request, reply) => {
    try {
      const { slotKey } = slotParamSchema.parse(request.params)
      const channel = await checkChannelLockMembership(request.dbUser!, slotKey)
      if (!channel) {
        reply.code(404).send({ error: 'NotFound', message: 'کانال پیدا نشد یا غیرفعال است' })
        return
      }
      reply.send({ channel })
    } catch (error) {
      handleRouteError(error, reply, 'CHANNEL_LOCK')
    }
  })
}
