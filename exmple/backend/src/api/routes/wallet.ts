import type { FastifyInstance, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { z } from 'zod'
import { log } from '../../lib/logger.js'
import {
  getWalletTransactions,
  syncWalletTransactions,
} from '../../wallet/wallet-transaction.service.js'
import { telegramAuthMiddleware } from '../middleware/telegram-auth.js'
import { requireUserMiddleware } from '../middleware/require-user.js'

const syncBodySchema = z.object({
  version: z.string().optional(),
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

  log.error(scope, error instanceof Error ? error.message : 'Unknown route error')
  reply.code(500).send({ error: 'InternalServerError', message: 'Unexpected server error' })
}

export async function walletRoutes(app: FastifyInstance): Promise<void> {
  const authChain = [telegramAuthMiddleware, requireUserMiddleware]

  app.get('/transactions', { preHandler: authChain }, async (request, reply) => {
    try {
      const payload = await getWalletTransactions(request.dbUser!.id)
      reply.send(payload)
    } catch (error) {
      handleRouteError(error, reply, 'WALLET')
    }
  })

  app.post('/transactions/sync', { preHandler: authChain }, async (request, reply) => {
    try {
      const body = syncBodySchema.parse(request.body ?? {})
      const result = await syncWalletTransactions(request.dbUser!.id, body.version)
      reply.send(result)
    } catch (error) {
      handleRouteError(error, reply, 'WALLET')
    }
  })
}
