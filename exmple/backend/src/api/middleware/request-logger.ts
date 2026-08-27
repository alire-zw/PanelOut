import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { log } from '../../lib/logger.js'

declare module 'fastify' {
  interface FastifyRequest {
    requestStartedAt?: number
  }
}

export function registerRequestLogger(app: FastifyInstance): void {
  app.addHook('onRequest', (request, _reply, done) => {
    request.requestStartedAt = Date.now()
    log.debug('HTTP', 'incoming', {
      method: request.method,
      url: request.url,
      ip: request.ip,
    })
    done()
  })

  app.addHook('onResponse', (request: FastifyRequest, reply: FastifyReply, done) => {
    const durationMs = Date.now() - (request.requestStartedAt ?? Date.now())
    log.http(request.method, request.url, reply.statusCode, durationMs, {
      ip: request.ip,
    })
    done()
  })
}
