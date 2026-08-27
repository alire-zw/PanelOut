import type { FastifyInstance, FastifyReply } from 'fastify'
import { z, ZodError } from 'zod'
import { log } from '../../lib/logger.js'
import { telegramAuthMiddleware } from '../middleware/telegram-auth.js'
import { requireUserMiddleware } from '../middleware/require-user.js'
import { getOrderByOrderId } from '../../orders/order.service.js'
import { serializeOrder } from '../../orders/order.serializer.js'
import { getUserOrders, syncUserOrders } from '../../orders/user-orders.service.js'

function handleRouteError(error: unknown, reply: FastifyReply): void {
  if (error instanceof ZodError) {
    reply.code(400).send({
      error: 'ValidationError',
      message: 'Invalid request data',
      details: error.flatten(),
    })
    return
  }

  log.error('ORDERS', error instanceof Error ? error.message : 'Unknown route error')
  reply.code(500).send({ error: 'InternalServerError', message: 'Unexpected server error' })
}

const syncBodySchema = z.object({
  version: z.string().min(1).max(64).optional(),
})

export async function orderRoutes(app: FastifyInstance): Promise<void> {
  const authChain = [telegramAuthMiddleware, requireUserMiddleware]

  app.get('/me', { preHandler: authChain }, async (request, reply) => {
    try {
      const payload = await getUserOrders(request.dbUser!.id)
      reply.send(payload)
    } catch (error) {
      handleRouteError(error, reply)
    }
  })

  app.post('/me/sync', { preHandler: authChain }, async (request, reply) => {
    try {
      const body = syncBodySchema.parse(request.body ?? {})
      const result = await syncUserOrders(request.dbUser!.id, body.version)
      reply.send(result)
    } catch (error) {
      handleRouteError(error, reply)
    }
  })

  app.get('/:orderId', { preHandler: authChain }, async (request, reply) => {
    try {
      const params = request.params as { orderId: string }
      const order = await getOrderByOrderId(params.orderId, request.dbUser!.id)

      if (!order) {
        reply.code(404).send({ error: 'NotFound', message: 'Order not found' })
        return
      }

      reply.send({ order: serializeOrder(order) })
    } catch (error) {
      handleRouteError(error, reply)
    }
  })
}
