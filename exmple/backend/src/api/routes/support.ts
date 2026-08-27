import type { FastifyInstance, FastifyReply } from 'fastify'
import { ZodError, z } from 'zod'
import { log } from '../../lib/logger.js'
import { telegramAuthMiddleware } from '../middleware/telegram-auth.js'
import { requireUserMiddleware } from '../middleware/require-user.js'
import {
  createUserTicketSchema,
  replyUserTicketSchema,
} from '../../support/support.schema.js'
import {
  SupportError,
  createUserTicket,
  getUserTicket,
  listUserSupportOrders,
  replyUserTicket,
  syncUserTicket,
} from '../../support/support.service.js'
import {
  getSupportTicketsCached,
  syncSupportTickets,
} from '../../support/support-tickets.service.js'
import { getSupportTelegramUsername } from '../../support/support-contact.service.js'

const syncBodySchema = z.object({
  version: z.string().optional(),
})

function handleRouteError(error: unknown, reply: FastifyReply, scope: string): void {
  if (error instanceof ZodError) {
    reply.code(400).send({
      error: 'ValidationError',
      message: error.issues[0]?.message ?? 'Invalid request',
    })
    return
  }
  if (error instanceof SupportError) {
    const code =
      error.code === 'NotFound'
        ? 404
        : error.code === 'Forbidden'
          ? 403
          : error.code === 'Conflict'
            ? 409
            : 400
    reply.code(code).send({ error: error.code, message: error.message })
    return
  }
  log.error(scope, error instanceof Error ? error.message : 'Unknown route error')
  reply.code(500).send({ error: 'InternalServerError', message: 'Unexpected server error' })
}

export async function supportRoutes(app: FastifyInstance): Promise<void> {
  const authChain = [telegramAuthMiddleware, requireUserMiddleware]

  app.get('/contact', { preHandler: authChain }, async (_request, reply) => {
    try {
      const telegramUsername = await getSupportTelegramUsername()
      reply.send({
        telegramUsername,
        telegramUrl: telegramUsername ? `https://t.me/${telegramUsername}` : null,
      })
    } catch (error) {
      handleRouteError(error, reply, 'SUPPORT')
    }
  })

  app.get('/orders', { preHandler: authChain }, async (request, reply) => {
    try {
      reply.send(await listUserSupportOrders(request.dbUser!.id))
    } catch (error) {
      handleRouteError(error, reply, 'SUPPORT')
    }
  })

  app.get('/tickets', { preHandler: authChain }, async (request, reply) => {
    try {
      reply.send(await getSupportTicketsCached(request.dbUser!.id))
    } catch (error) {
      handleRouteError(error, reply, 'SUPPORT')
    }
  })

  app.post('/tickets/sync', { preHandler: authChain }, async (request, reply) => {
    try {
      const body = syncBodySchema.parse(request.body ?? {})
      reply.send(await syncSupportTickets(request.dbUser!.id, body.version))
    } catch (error) {
      handleRouteError(error, reply, 'SUPPORT')
    }
  })

  app.get('/tickets/:idOrCode', { preHandler: authChain }, async (request, reply) => {
    try {
      const { idOrCode } = request.params as { idOrCode: string }
      reply.send(await getUserTicket(request.dbUser!.id, idOrCode))
    } catch (error) {
      handleRouteError(error, reply, 'SUPPORT')
    }
  })

  app.post('/tickets/:idOrCode/sync', { preHandler: authChain }, async (request, reply) => {
    try {
      const { idOrCode } = request.params as { idOrCode: string }
      const body = syncBodySchema.parse(request.body ?? {})
      reply.send(await syncUserTicket(request.dbUser!.id, idOrCode, body.version))
    } catch (error) {
      handleRouteError(error, reply, 'SUPPORT')
    }
  })

  app.post('/tickets', { preHandler: authChain }, async (request, reply) => {
    try {
      const body = createUserTicketSchema.parse(request.body)
      const result = await createUserTicket(request.dbUser!.id, body)
      reply.code(201).send(result)
    } catch (error) {
      handleRouteError(error, reply, 'SUPPORT')
    }
  })

  app.post('/tickets/:idOrCode/messages', { preHandler: authChain }, async (request, reply) => {
    try {
      const { idOrCode } = request.params as { idOrCode: string }
      const body = replyUserTicketSchema.parse(request.body)
      reply.send(await replyUserTicket(request.dbUser!.id, idOrCode, body))
    } catch (error) {
      handleRouteError(error, reply, 'SUPPORT')
    }
  })
}
