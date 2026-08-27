import type { FastifyInstance, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { z } from 'zod'
import { log } from '../../lib/logger.js'
import { telegramAuthMiddleware } from '../middleware/telegram-auth.js'
import { requireUserMiddleware } from '../middleware/require-user.js'
import {
  consumeContactPickerResult,
  createContactPickerSession,
  readContactPickerResult,
} from '../../transfers/contact-picker.service.js'
import { searchTransferRecipients } from '../../transfers/recipient-search.service.js'
import { executeTransferSchema } from '../../transfers/transfer.schema.js'
import {
  executeTransfer,
  getTransferByOrderId,
  TransferError,
} from '../../transfers/transfer.service.js'

const recipientSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(128),
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

export async function transferRoutes(app: FastifyInstance): Promise<void> {
  const authChain = [telegramAuthMiddleware, requireUserMiddleware]

  app.get('/recipients/search', { preHandler: authChain }, async (request, reply) => {
    try {
      const query = recipientSearchQuerySchema.parse(request.query)
      const users = await searchTransferRecipients({
        query: query.q,
        excludeTelegramId: request.dbUser!.telegramId,
      })

      reply.send({ users })
    } catch (error) {
      handleRouteError(error, reply, 'TRANSFER')
    }
  })

  app.post('/contact-picker', { preHandler: authChain }, async (request, reply) => {
    try {
      const session = await createContactPickerSession(Number(request.dbUser!.telegramId))
      reply.send(session)
    } catch (error) {
      if (error instanceof Error && error.message.includes('BUTTON_TYPE_INVALID')) {
        reply.code(503).send({
          error: 'UnsupportedClient',
          message: 'Telegram bot API does not support contact picker on this server',
        })
        return
      }

      handleRouteError(error, reply, 'TRANSFER')
    }
  })

  app.get('/contact-picker/:requestId', { preHandler: authChain }, async (request, reply) => {
    try {
      const params = request.params as { requestId: string }
      const requestId = Number.parseInt(params.requestId, 10)

      if (!Number.isFinite(requestId)) {
        reply.code(400).send({ error: 'BadRequest', message: 'Invalid request id' })
        return
      }

      const users = await readContactPickerResult(Number(request.dbUser!.telegramId), requestId)

      if (!users || users.length === 0) {
        reply.code(404).send({ error: 'NotFound', message: 'Contact selection is pending' })
        return
      }

      reply.send({ users })
    } catch (error) {
      handleRouteError(error, reply, 'TRANSFER')
    }
  })

  app.delete('/contact-picker/:requestId', { preHandler: authChain }, async (request, reply) => {
    try {
      const params = request.params as { requestId: string }
      const requestId = Number.parseInt(params.requestId, 10)

      if (!Number.isFinite(requestId)) {
        reply.code(400).send({ error: 'BadRequest', message: 'Invalid request id' })
        return
      }

      await consumeContactPickerResult(Number(request.dbUser!.telegramId), requestId)
      reply.send({ ok: true })
    } catch (error) {
      handleRouteError(error, reply, 'TRANSFER')
    }
  })

  app.post('/execute', { preHandler: authChain }, async (request, reply) => {
    try {
      const body = executeTransferSchema.parse(request.body)
      const transfer = await executeTransfer(request.dbUser!, body)
      reply.send({ transfer })
    } catch (error) {
      if (error instanceof TransferError) {
        const status =
          error.code === 'INSUFFICIENT_BALANCE'
            ? 409
            : error.code === 'RECIPIENT_NOT_FOUND' || error.code === 'RECIPIENT_UNAVAILABLE'
              ? 404
              : 400

        reply.code(status).send({
          error: error.code,
          message:
            error.code === 'SELF_TRANSFER'
              ? 'امکان انتقال به خودتان وجود ندارد'
              : error.code === 'RECIPIENT_NOT_FOUND'
                ? 'گیرنده یافت نشد'
                : error.code === 'RECIPIENT_UNAVAILABLE'
                  ? 'گیرنده در دسترس نیست'
                  : error.code === 'INSUFFICIENT_BALANCE'
                    ? 'موجودی کیف پول شما کافی نیست'
                    : error.message,
        })
        return
      }

      handleRouteError(error, reply, 'TRANSFER')
    }
  })

  app.get('/order/:transferId', { preHandler: authChain }, async (request, reply) => {
    try {
      const params = request.params as { transferId: string }
      const transfer = await getTransferByOrderId(params.transferId, request.dbUser!.id)

      if (!transfer) {
        reply.code(404).send({ error: 'NotFound', message: 'Transfer not found' })
        return
      }

      reply.send({ transfer })
    } catch (error) {
      handleRouteError(error, reply, 'TRANSFER')
    }
  })
}
