import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import fastifyStatic from '@fastify/static'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { env, corsOrigins } from '../config/env.js'
import { redis } from '../redis/client.js'
import { registerRoutes } from './routes/index.js'
import { errorHandler } from './middleware/error-handler.js'
import { registerRequestLogger } from './middleware/request-logger.js'

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

export async function buildApp() {
  const app = Fastify({
    logger: false,
    trustProxy: env.TRUST_PROXY ?? env.NODE_ENV === 'production',
    bodyLimit: 1_048_576,
    requestTimeout: 30_000,
  })

  app.setErrorHandler(errorHandler)
  registerRequestLogger(app)

  await app.register(helmet, {
    contentSecurityPolicy: env.NODE_ENV === 'production',
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    global: true,
  })

  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin || corsOrigins.includes(origin)) {
        callback(null, true)
        return
      }

      callback(new Error('Origin not allowed'), false)
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Telegram-Init-Data'],
  })

  await app.register(rateLimit, {
    global: true,
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
    ban: 0,
    skipOnError: false,
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
    redis: redis,
    nameSpace: 'viraltel:rl:',
    continueExceeding: false,
    enableDraftSpec: true,
    errorResponseBuilder: (_request, context) => {
      const waitSeconds = Math.max(1, Math.ceil((context.ttl || 0) / 1000))
      const waitLabel =
        waitSeconds < 60
          ? `${waitSeconds} ثانیه`
          : waitSeconds < 3600
            ? `${Math.ceil(waitSeconds / 60)} دقیقه`
            : `${Math.ceil(waitSeconds / 3600)} ساعت`

      const error = new Error(
        `تعداد درخواست‌ها بیش از حد مجاز است. لطفاً ${waitLabel} دیگر دوباره تلاش کنید.`,
      ) as Error & { statusCode: number; retryAfterSeconds: number }
      error.statusCode = context.statusCode
      error.retryAfterSeconds = waitSeconds
      return error
    },
  })

  await app.register(fastifyStatic, {
    root: path.join(backendRoot, 'uploads'),
    prefix: '/uploads/',
    decorateReply: false,
    maxAge: 365 * 24 * 60 * 60 * 1000,
    immutable: true,
    setHeaders: (reply) => {
      reply.header('Cross-Origin-Resource-Policy', 'cross-origin')
      reply.header('Access-Control-Allow-Origin', '*')
      reply.header('Cache-Control', 'public, max-age=31536000, immutable')
    },
  })

  await registerRoutes(app)

  return app
}
