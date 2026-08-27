import type { FastifyInstance, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { log } from '../../lib/logger.js'
import { telegramAuthMiddleware } from '../middleware/telegram-auth.js'
import { requireUserMiddleware } from '../middleware/require-user.js'
import { requireStaffMiddleware } from '../middleware/require-role.js'
import { recordProductViewSchema } from '../../analytics/analytics.schema.js'
import { listProductViewStats, recordProductView } from '../../analytics/product-views.service.js'
import { getOnlineStats, touchUserPresence } from '../../analytics/presence.service.js'

function handleRouteError(error: unknown, reply: FastifyReply, scope: string): void {
  if (error instanceof ZodError) {
    reply.code(400).send({
      error: 'ValidationError',
      message: error.issues[0]?.message ?? 'Invalid request data',
      details: error.flatten(),
    })
    return
  }

  log.error(scope, error instanceof Error ? error.message : 'Unknown route error')
  reply.code(500).send({ error: 'InternalServerError', message: 'Unexpected server error' })
}

export async function analyticsRoutes(app: FastifyInstance): Promise<void> {
  const authChain = [telegramAuthMiddleware, requireUserMiddleware]
  const staffChain = [...authChain, requireStaffMiddleware]

  app.post('/product-view', { preHandler: authChain }, async (request, reply) => {
    try {
      const body = recordProductViewSchema.parse(request.body)
      const result = await recordProductView(request.dbUser!.id, body.productKey)
      reply.send(result)
    } catch (error) {
      handleRouteError(error, reply, 'ANALYTICS')
    }
  })

  app.post('/heartbeat', { preHandler: authChain }, async (request, reply) => {
    try {
      const onlineCount = await touchUserPresence(request.dbUser!.id)
      reply.send({ ok: true, onlineCount })
    } catch (error) {
      handleRouteError(error, reply, 'ANALYTICS')
    }
  })

  app.get('/product-views', { preHandler: staffChain }, async (_request, reply) => {
    try {
      const stats = await listProductViewStats()
      reply.send(stats)
    } catch (error) {
      handleRouteError(error, reply, 'ANALYTICS')
    }
  })

  app.get('/online', { preHandler: staffChain }, async (_request, reply) => {
    try {
      const stats = await getOnlineStats()
      reply.send(stats)
    } catch (error) {
      handleRouteError(error, reply, 'ANALYTICS')
    }
  })
}
