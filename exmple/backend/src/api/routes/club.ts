import type { FastifyInstance, FastifyReply } from 'fastify'
import { log } from '../../lib/logger.js'
import { telegramAuthMiddleware } from '../middleware/telegram-auth.js'
import { requireUserMiddleware } from '../middleware/require-user.js'
import { requireStaffMiddleware } from '../middleware/require-role.js'
import {
  getClubPoints,
  syncAllUsersClubPoints,
  syncUserClubPoints,
} from '../../club/club-points.service.js'
import { serializeUser } from '../../users/user.serializer.js'

function handleRouteError(error: unknown, reply: FastifyReply, scope: string): void {
  log.error(scope, error instanceof Error ? error.message : 'Unknown route error')
  reply.code(500).send({ error: 'InternalServerError', message: 'Unexpected server error' })
}

export async function clubRoutes(app: FastifyInstance): Promise<void> {
  const authChain = [telegramAuthMiddleware, requireUserMiddleware]
  const staffChain = [...authChain, requireStaffMiddleware]

  app.get('/me', { preHandler: authChain }, async (request, reply) => {
    try {
      const clubPoints = await getClubPoints(request.dbUser!.id)
      reply.send({
        clubPoints,
        user: serializeUser({ ...request.dbUser!, clubPoints }),
      })
    } catch (error) {
      handleRouteError(error, reply, 'CLUB')
    }
  })

  app.post('/sync', { preHandler: authChain }, async (request, reply) => {
    try {
      const result = await syncUserClubPoints(request.dbUser!.id)
      reply.send(result)
    } catch (error) {
      handleRouteError(error, reply, 'CLUB')
    }
  })

  app.post('/sync-all', { preHandler: staffChain }, async (_request, reply) => {
    try {
      const result = await syncAllUsersClubPoints()
      log.info('CLUB', 'synced club points for all users', result)
      reply.send(result)
    } catch (error) {
      handleRouteError(error, reply, 'CLUB')
    }
  })
}
