import type { DbUser } from '../../db/types.js'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { touchUserPresenceSafe } from '../../analytics/presence.service.js'
import { findUserById, findOrCreateUserFromTelegram } from '../../users/user.service.js'

declare module 'fastify' {
  interface FastifyRequest {
    dbUser?: DbUser
  }
}

export async function requireUserMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  let user: DbUser | null = null

  if (request.browserUserId) {
    user = await findUserById(request.browserUserId)
    if (!user) {
      reply.code(401).send({ error: 'Unauthorized', message: 'Browser session user not found' })
      return
    }
  } else if (request.telegramUser) {
    user = await findOrCreateUserFromTelegram(request.telegramUser)
  } else {
    reply.code(401).send({ error: 'Unauthorized', message: 'Authentication required' })
    return
  }

  if (user.isBanned) {
    reply.code(403).send({ error: 'Forbidden', message: 'Account is banned' })
    return
  }

  if (!user.isActive) {
    reply.code(403).send({ error: 'Forbidden', message: 'Account is inactive' })
    return
  }

  request.dbUser = user
  touchUserPresenceSafe(user.id)
}
