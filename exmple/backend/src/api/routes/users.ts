import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { ZodError } from 'zod'
import { log } from '../../lib/logger.js'
import { telegramAuthMiddleware } from '../middleware/telegram-auth.js'
import { requireUserMiddleware } from '../middleware/require-user.js'
import { requireStaffMiddleware } from '../middleware/require-role.js'
import {
  createUserSchema,
  listUsersQuerySchema,
  updateMeSchema,
  updateUserSchema,
} from '../../users/user.schema.js'
import {
  canManageUser,
  createUser,
  deactivateUser,
  findUserById,
  isPrismaUniqueError,
  isStaffRole,
  listUsers,
  updateCurrentUser,
  updateUserById,
} from '../../users/user.service.js'
import { serializeUser, serializeUsers } from '../../users/user.serializer.js'

function parseBody<T>(schema: { parse: (value: unknown) => T }, body: unknown): T {
  return schema.parse(body)
}

function parseQuery<T>(schema: { parse: (value: unknown) => T }, query: unknown): T {
  return schema.parse(query)
}

function handleRouteError(error: unknown, reply: FastifyReply, scope: string): void {
  if (error instanceof ZodError) {
    reply.code(400).send({
      error: 'ValidationError',
      message: 'Invalid request data',
      details: error.flatten(),
    })
    return
  }

  if (isPrismaUniqueError(error)) {
    reply.code(409).send({
      error: 'Conflict',
      message: 'Telegram ID or email already exists',
    })
    return
  }

  log.error(scope, error instanceof Error ? error.message : 'Unknown route error')
  reply.code(500).send({ error: 'InternalServerError', message: 'Unexpected server error' })
}

async function getNumericParam(request: FastifyRequest, key: string): Promise<number | null> {
  const params = request.params as Record<string, string>
  const value = Number.parseInt(params[key] ?? '', 10)
  return Number.isFinite(value) ? value : null
}

export async function userRoutes(app: FastifyInstance): Promise<void> {
  const authChain = [telegramAuthMiddleware, requireUserMiddleware]

  app.get('/me', { preHandler: authChain }, async (request, reply) => {
    reply.send({ user: serializeUser(request.dbUser!) })
  })

  app.patch('/me', { preHandler: authChain }, async (request, reply) => {
    try {
      const body = parseBody(updateMeSchema, request.body)
      const user = await updateCurrentUser(request.dbUser!.id, body)
      log.db('profile updated', { id: user.id, userId: user.telegramId.toString() })
      reply.send({ user: serializeUser(user) })
    } catch (error) {
      handleRouteError(error, reply, 'USERS')
    }
  })

  app.get('/', { preHandler: [...authChain, requireStaffMiddleware] }, async (request, reply) => {
    try {
      const query = parseQuery(listUsersQuerySchema, request.query)
      if (request.dbUser!.role === 'supervisor') {
        query.role = 'user'
      }
      const result = await listUsers(query)
      reply.send({
        ...result,
        items: serializeUsers(result.items),
      })
    } catch (error) {
      handleRouteError(error, reply, 'USERS')
    }
  })

  app.get('/:id', { preHandler: authChain }, async (request, reply) => {
    try {
      const id = await getNumericParam(request, 'id')
      if (!id) {
        reply.code(400).send({ error: 'BadRequest', message: 'Invalid user id' })
        return
      }

      const user = await findUserById(id)
      if (!user) {
        reply.code(404).send({ error: 'NotFound', message: 'User not found' })
        return
      }

      const actor = request.dbUser!
      if (!isStaffRole(actor.role) && actor.id !== user.id) {
        reply.code(403).send({ error: 'Forbidden', message: 'Insufficient permissions' })
        return
      }

      if (actor.role === 'supervisor' && user.role !== 'user' && actor.id !== user.id) {
        reply.code(403).send({ error: 'Forbidden', message: 'Supervisor cannot view staff users' })
        return
      }

      reply.send({ user: serializeUser(user) })
    } catch (error) {
      handleRouteError(error, reply, 'USERS')
    }
  })

  app.post('/', { preHandler: [...authChain, requireStaffMiddleware] }, async (request, reply) => {
    try {
      if (request.dbUser!.role !== 'admin') {
        reply.code(403).send({ error: 'Forbidden', message: 'Only admin can create users' })
        return
      }

      const body = parseBody(createUserSchema, request.body)
      const user = await createUser(body)
      log.db('user created', { id: user.id, telegramId: user.telegramId.toString(), role: user.role })
      reply.code(201).send({ user: serializeUser(user) })
    } catch (error) {
      handleRouteError(error, reply, 'USERS')
    }
  })

  app.patch('/:id', { preHandler: authChain }, async (request, reply) => {
    try {
      const id = await getNumericParam(request, 'id')
      if (!id) {
        reply.code(400).send({ error: 'BadRequest', message: 'Invalid user id' })
        return
      }

      const target = await findUserById(id)
      if (!target) {
        reply.code(404).send({ error: 'NotFound', message: 'User not found' })
        return
      }

      const actor = request.dbUser!
      if (!canManageUser(actor, target)) {
        reply.code(403).send({ error: 'Forbidden', message: 'Insufficient permissions' })
        return
      }

      const body = parseBody(updateUserSchema, request.body)

      if (!isStaffRole(actor.role)) {
        reply.code(403).send({ error: 'Forbidden', message: 'Use PATCH /users/me for self updates' })
        return
      }

      if (actor.role === 'supervisor') {
        if (body.role && body.role !== 'user') {
          reply.code(403).send({ error: 'Forbidden', message: 'Supervisor cannot assign staff roles' })
          return
        }
        if (body.balance !== undefined) {
          reply.code(403).send({ error: 'Forbidden', message: 'Supervisor cannot change balance' })
          return
        }
      }

      const user = await updateUserById(id, body)
      log.db('user updated', { id: user.id, by: actor.id, role: user.role })
      reply.send({ user: serializeUser(user) })
    } catch (error) {
      handleRouteError(error, reply, 'USERS')
    }
  })

  app.delete('/:id', { preHandler: [...authChain, requireStaffMiddleware] }, async (request, reply) => {
    try {
      if (request.dbUser!.role !== 'admin') {
        reply.code(403).send({ error: 'Forbidden', message: 'Only admin can deactivate users' })
        return
      }

      const id = await getNumericParam(request, 'id')
      if (!id) {
        reply.code(400).send({ error: 'BadRequest', message: 'Invalid user id' })
        return
      }

      if (id === request.dbUser!.id) {
        reply.code(400).send({ error: 'BadRequest', message: 'Cannot deactivate your own account' })
        return
      }

      const existing = await findUserById(id)
      if (!existing) {
        reply.code(404).send({ error: 'NotFound', message: 'User not found' })
        return
      }

      const user = await deactivateUser(id)
      log.db('user deactivated', { id: user.id, by: request.dbUser!.id })
      reply.send({ user: serializeUser(user) })
    } catch (error) {
      handleRouteError(error, reply, 'USERS')
    }
  })
}
