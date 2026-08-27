import type { FastifyInstance, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { log } from '../../lib/logger.js'
import { telegramAuthMiddleware } from '../middleware/telegram-auth.js'
import { requireUserMiddleware } from '../middleware/require-user.js'
import {
  addBankCardBodySchema,
  addBankCardForUser,
  BankCardError,
  listBankCardsForUser,
} from '../../cards/card.service.js'

function handleRouteError(error: unknown, reply: FastifyReply, scope: string): void {
  if (error instanceof ZodError) {
    reply.code(400).send({
      error: 'ValidationError',
      message: 'Invalid request data',
      details: error.flatten(),
    })
    return
  }

  if (error instanceof BankCardError) {
    const status = error.code === 'DUPLICATE' ? 409 : 400
    reply.code(status).send({
      error: 'BankCardError',
      message: error.message,
      code: error.code,
    })
    return
  }

  log.error(scope, error instanceof Error ? error.message : 'Unknown route error')
  reply.code(500).send({ error: 'InternalServerError', message: 'Unexpected server error' })
}

export async function cardRoutes(app: FastifyInstance): Promise<void> {
  const authChain = [telegramAuthMiddleware, requireUserMiddleware]

  app.get('/', { preHandler: authChain }, async (request, reply) => {
    try {
      const cards = await listBankCardsForUser(request.dbUser!.id)
      reply.send({ cards })
    } catch (error) {
      handleRouteError(error, reply, 'CARDS')
    }
  })

  app.post('/', { preHandler: authChain }, async (request, reply) => {
    try {
      const body = addBankCardBodySchema.parse(request.body)
      const card = await addBankCardForUser(request.dbUser!.id, body)
      reply.code(201).send({ card })
    } catch (error) {
      handleRouteError(error, reply, 'CARDS')
    }
  })
}
