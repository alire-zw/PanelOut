import type { FastifyInstance } from 'fastify'
import { prisma } from '../../db/client.js'
import { redis } from '../../redis/client.js'

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }))

  app.get('/health/ready', async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`
      const pong = await redis.ping()

      if (pong !== 'PONG') {
        throw new Error('Redis ping failed')
      }

      return {
        status: 'ready',
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      reply.code(503).send({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        message: error instanceof Error ? error.message : 'Dependency check failed',
      })
    }
  })
}
