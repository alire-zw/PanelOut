import { Redis } from 'ioredis'
import { env } from '../config/env.js'
import { formatError, log } from '../lib/logger.js'

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,
})

redis.on('error', (error: Error) => {
  log.error('REDIS', formatError(error))
})

export async function connectRedis(): Promise<void> {
  if (redis.status === 'wait') {
    await redis.connect()
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redis.status !== 'end') {
    await redis.quit()
  }
}
