import type { DbUserRole } from '../../db/types.js'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { canAccessAdminPanel } from '../../config/main-admins.js'

export function requireRole(...roles: DbUserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.dbUser) {
      reply.code(401).send({ error: 'Unauthorized', message: 'Authentication required' })
      return
    }

    if (!roles.includes(request.dbUser.role)) {
      reply.code(403).send({ error: 'Forbidden', message: 'Insufficient permissions' })
      return
    }
  }
}

export async function requireStaffMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!request.dbUser) {
    reply.code(401).send({ error: 'Unauthorized', message: 'Authentication required' })
    return
  }

  if (request.dbUser.role !== 'admin' && request.dbUser.role !== 'supervisor') {
    reply.code(403).send({ error: 'Forbidden', message: 'Staff access required' })
  }
}

export async function requireMainAdminMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!request.dbUser) {
    reply.code(401).send({ error: 'Unauthorized', message: 'Authentication required' })
    return
  }

  if (!canAccessAdminPanel(request.dbUser)) {
    reply.code(403).send({ error: 'Forbidden', message: 'Main admin access required' })
  }
}
