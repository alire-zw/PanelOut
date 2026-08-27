import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { ZodError, z } from 'zod'
import { log } from '../../lib/logger.js'
import { telegramAuthMiddleware } from '../middleware/telegram-auth.js'
import { requireUserMiddleware } from '../middleware/require-user.js'
import { requireMainAdminMiddleware } from '../middleware/require-role.js'
import {
  listAdminCryptoPaymentsQuerySchema,
  listAdminOrdersQuerySchema,
  listAdminPaymentsQuerySchema,
  listAdminTransfersQuerySchema,
} from '../../admin/admin.schema.js'
import {
  createClubRewardSchema,
  createDiscountSchema,
  createTicketSchema,
  listTicketsQuerySchema,
  replyTicketSchema,
  updateClubRewardSchema,
  updateDiscountSchema,
  upsertPricingSchema,
} from '../../admin/admin-commerce.schema.js'
import {
  getAdminOrderByOrderId,
  getAdminOverview,
  listAdminCryptoPayments,
  listAdminOrders,
  listAdminPayments,
  listAdminTransfers,
} from '../../admin/admin.service.js'
import {
  createClubReward,
  createDiscount,
  createSupportTicket,
  deleteClubReward,
  deleteDiscount,
  getSupportTicket,
  listClubRewards,
  listDiscounts,
  listProductPricing,
  listSupportTickets,
  replySupportTicket,
  updateClubReward,
  updateDiscount,
  upsertProductPricing,
} from '../../admin/admin-commerce.service.js'
import { getAdminPricingCatalog } from '../../admin/admin-pricing-catalog.service.js'
import {
  createShopBannerSchema,
  updateShopBannerSchema,
} from '../../admin/admin-shop-banners.schema.js'
import {
  createShopBanner,
  deleteShopBanner,
  listShopBannersAdmin,
  updateShopBanner,
} from '../../admin/admin-shop-banners.service.js'
import {
  createAccountShopPlanSchema,
  listAccountShopPlansQuerySchema,
  roboticvnProductsQuerySchema,
  updateAccountShopPlanSchema,
} from '../../admin/admin-account-plans.schema.js'
import {
  createAccountShopPlan,
  deleteAccountShopPlan,
  getAccountShopPlanAdmin,
  getRoboticvnProductForAdmin,
  listAccountShopPlansAdmin,
  searchRoboticvnProductsForAdmin,
  updateAccountShopPlan,
} from '../../admin/admin-account-plans.service.js'
import {
  listAdminAccountOrdersQuerySchema,
  updateAdminAccountOrderStatusBodySchema,
} from '../../admin/admin-account-orders.schema.js'
import {
  AccountShopPurchaseError,
  getAdminAccountOrderByOrderId,
  listAdminAccountOrders,
  updateAdminAccountOrderStatus,
} from '../../admin/admin-account-orders.service.js'
import { RoboticvnApiError } from '../../roboticvn/roboticvn.client.js'
import {
  AdminSystemChannelError,
  deactivateAdminSystemChannel,
  deleteAdminSystemChannel,
  getAdminSystemChannelsBotInfo,
  listAdminSystemChannels,
  registerAdminSystemChannel,
  setAdminSystemChannelActive,
} from '../../admin/admin-system-channels.service.js'
import {
  adminSystemChannelSlotSchema,
  registerAdminSystemChannelSchema,
  setAdminSystemChannelActiveSchema,
} from '../../admin/admin-system-channels.schema.js'
import {
  getSupportTelegramUsername,
  setSupportTelegramUsername,
} from '../../support/support-contact.service.js'

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

  if (error instanceof AdminSystemChannelError) {
    const status =
      error.code === 'NOT_FOUND'
        ? 404
        : error.code === 'BOT_NOT_ADMIN' ||
            error.code === 'USER_NOT_ADMIN' ||
            error.code === 'CHANNEL_UNAVAILABLE'
          ? 409
          : 400
    reply.code(status).send({
      error: 'AdminSystemChannelError',
      message: error.message,
      code: error.code,
    })
    return
  }

  if (error instanceof AccountShopPurchaseError) {
    const status =
      error.code === 'ORDER_NOT_FOUND'
        ? 404
        : error.code === 'INVALID_STATUS'
          ? 409
          : 400
    reply.code(status).send({
      error: 'AccountShopPurchaseError',
      message: error.message,
      code: error.code,
    })
    return
  }

  if (error instanceof RoboticvnApiError) {
    reply.code(error.status >= 400 && error.status < 600 ? error.status : 502).send({
      error: 'RoboticvnApiError',
      message: error.message,
    })
    return
  }

  log.error(scope, error instanceof Error ? error.message : 'Unknown route error')
  reply.code(500).send({ error: 'InternalServerError', message: 'Unexpected server error' })
}

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  const mainAdminChain = [
    telegramAuthMiddleware,
    requireUserMiddleware,
    requireMainAdminMiddleware,
  ]

  app.get('/overview', { preHandler: mainAdminChain }, async (_request, reply) => {
    try {
      reply.send(await getAdminOverview())
    } catch (error) {
      handleRouteError(error, reply, 'ADMIN')
    }
  })

  app.get('/orders', { preHandler: mainAdminChain }, async (request, reply) => {
    try {
      reply.send(await listAdminOrders(parseQuery(listAdminOrdersQuerySchema, request.query)))
    } catch (error) {
      handleRouteError(error, reply, 'ADMIN')
    }
  })

  app.get(
    '/orders/:orderId',
    { preHandler: mainAdminChain },
    async (request: FastifyRequest, reply) => {
      try {
        const orderId = (request.params as { orderId?: string }).orderId?.trim()
        if (!orderId) {
          reply.code(400).send({ error: 'BadRequest', message: 'Invalid order id' })
          return
        }
        const result = await getAdminOrderByOrderId(orderId)
        if (!result) {
          reply.code(404).send({ error: 'NotFound', message: 'Order not found' })
          return
        }
        reply.send(result)
      } catch (error) {
        handleRouteError(error, reply, 'ADMIN')
      }
    },
  )

  app.get('/payments', { preHandler: mainAdminChain }, async (request, reply) => {
    try {
      reply.send(await listAdminPayments(parseQuery(listAdminPaymentsQuerySchema, request.query)))
    } catch (error) {
      handleRouteError(error, reply, 'ADMIN')
    }
  })

  app.get('/crypto-payments', { preHandler: mainAdminChain }, async (request, reply) => {
    try {
      reply.send(
        await listAdminCryptoPayments(
          parseQuery(listAdminCryptoPaymentsQuerySchema, request.query),
        ),
      )
    } catch (error) {
      handleRouteError(error, reply, 'ADMIN')
    }
  })

  app.get('/transfers', { preHandler: mainAdminChain }, async (request, reply) => {
    try {
      reply.send(await listAdminTransfers(parseQuery(listAdminTransfersQuerySchema, request.query)))
    } catch (error) {
      handleRouteError(error, reply, 'ADMIN')
    }
  })

  app.get('/club-rewards', { preHandler: mainAdminChain }, async (_request, reply) => {
    try {
      reply.send(await listClubRewards())
    } catch (error) {
      handleRouteError(error, reply, 'ADMIN')
    }
  })

  app.post('/club-rewards', { preHandler: mainAdminChain }, async (request, reply) => {
    try {
      reply.code(201).send(await createClubReward(createClubRewardSchema.parse(request.body)))
    } catch (error) {
      handleRouteError(error, reply, 'ADMIN')
    }
  })

  app.patch('/club-rewards/:id', { preHandler: mainAdminChain }, async (request, reply) => {
    try {
      const id = Number((request.params as { id?: string }).id)
      if (!Number.isFinite(id)) {
        reply.code(400).send({ error: 'BadRequest', message: 'Invalid id' })
        return
      }
      reply.send(await updateClubReward(id, updateClubRewardSchema.parse(request.body)))
    } catch (error) {
      handleRouteError(error, reply, 'ADMIN')
    }
  })

  app.delete('/club-rewards/:id', { preHandler: mainAdminChain }, async (request, reply) => {
    try {
      const id = Number((request.params as { id?: string }).id)
      if (!Number.isFinite(id)) {
        reply.code(400).send({ error: 'BadRequest', message: 'Invalid id' })
        return
      }
      reply.send(await deleteClubReward(id))
    } catch (error) {
      handleRouteError(error, reply, 'ADMIN')
    }
  })

  app.get('/discounts', { preHandler: mainAdminChain }, async (_request, reply) => {
    try {
      reply.send(await listDiscounts())
    } catch (error) {
      handleRouteError(error, reply, 'ADMIN')
    }
  })

  app.post('/discounts', { preHandler: mainAdminChain }, async (request, reply) => {
    try {
      reply.code(201).send(await createDiscount(createDiscountSchema.parse(request.body)))
    } catch (error) {
      handleRouteError(error, reply, 'ADMIN')
    }
  })

  app.patch('/discounts/:id', { preHandler: mainAdminChain }, async (request, reply) => {
    try {
      const id = Number((request.params as { id?: string }).id)
      if (!Number.isFinite(id)) {
        reply.code(400).send({ error: 'BadRequest', message: 'Invalid id' })
        return
      }
      reply.send(await updateDiscount(id, updateDiscountSchema.parse(request.body)))
    } catch (error) {
      handleRouteError(error, reply, 'ADMIN')
    }
  })

  app.delete('/discounts/:id', { preHandler: mainAdminChain }, async (request, reply) => {
    try {
      const id = Number((request.params as { id?: string }).id)
      if (!Number.isFinite(id)) {
        reply.code(400).send({ error: 'BadRequest', message: 'Invalid id' })
        return
      }
      reply.send(await deleteDiscount(id))
    } catch (error) {
      handleRouteError(error, reply, 'ADMIN')
    }
  })

  app.get('/pricing', { preHandler: mainAdminChain }, async (_request, reply) => {
    try {
      reply.send(await listProductPricing())
    } catch (error) {
      handleRouteError(error, reply, 'ADMIN')
    }
  })

  app.put('/pricing', { preHandler: mainAdminChain }, async (request, reply) => {
    try {
      reply.send(await upsertProductPricing(upsertPricingSchema.parse(request.body)))
    } catch (error) {
      handleRouteError(error, reply, 'ADMIN')
    }
  })

  app.get('/pricing/:productKey/catalog', { preHandler: mainAdminChain }, async (request, reply) => {
    try {
      const { productKey } = request.params as { productKey: string }
      reply.send(await getAdminPricingCatalog(productKey))
    } catch (error) {
      handleRouteError(error, reply, 'ADMIN')
    }
  })

  app.get('/tickets', { preHandler: mainAdminChain }, async (request, reply) => {
    try {
      reply.send(await listSupportTickets(parseQuery(listTicketsQuerySchema, request.query)))
    } catch (error) {
      handleRouteError(error, reply, 'ADMIN')
    }
  })

  app.get('/tickets/:id', { preHandler: mainAdminChain }, async (request, reply) => {
    try {
      const id = Number((request.params as { id?: string }).id)
      if (!Number.isFinite(id)) {
        reply.code(400).send({ error: 'BadRequest', message: 'Invalid id' })
        return
      }
      const result = await getSupportTicket(id)
      if (!result) {
        reply.code(404).send({ error: 'NotFound', message: 'Ticket not found' })
        return
      }
      reply.send(result)
    } catch (error) {
      handleRouteError(error, reply, 'ADMIN')
    }
  })

  app.post('/tickets', { preHandler: mainAdminChain }, async (request, reply) => {
    try {
      reply.code(201).send(await createSupportTicket(createTicketSchema.parse(request.body)))
    } catch (error) {
      handleRouteError(error, reply, 'ADMIN')
    }
  })

  app.post('/tickets/:id/reply', { preHandler: mainAdminChain }, async (request, reply) => {
    try {
      const id = Number((request.params as { id?: string }).id)
      if (!Number.isFinite(id)) {
        reply.code(400).send({ error: 'BadRequest', message: 'Invalid id' })
        return
      }
      const result = await replySupportTicket(id, replyTicketSchema.parse(request.body))
      if (!result) {
        reply.code(404).send({ error: 'NotFound', message: 'Ticket not found' })
        return
      }
      reply.send(result)
    } catch (error) {
      handleRouteError(error, reply, 'ADMIN')
    }
  })

  app.get('/system-channels/bot', { preHandler: mainAdminChain }, async (_request, reply) => {
    try {
      reply.send(await getAdminSystemChannelsBotInfo())
    } catch (error) {
      handleRouteError(error, reply, 'ADMIN')
    }
  })

  app.get('/system-channels', { preHandler: mainAdminChain }, async (_request, reply) => {
    try {
      reply.send(await listAdminSystemChannels())
    } catch (error) {
      handleRouteError(error, reply, 'ADMIN')
    }
  })

  app.post('/system-channels/:slotKey/register', { preHandler: mainAdminChain }, async (request, reply) => {
    try {
      const slotKey = adminSystemChannelSlotSchema.parse(
        (request.params as { slotKey?: string }).slotKey,
      )
      const body = registerAdminSystemChannelSchema.parse(request.body)
      reply.send(await registerAdminSystemChannel(request.dbUser!, slotKey, body.link))
    } catch (error) {
      handleRouteError(error, reply, 'ADMIN')
    }
  })

  app.post(
    '/system-channels/:slotKey/deactivate',
    { preHandler: mainAdminChain },
    async (request, reply) => {
      try {
        const slotKey = adminSystemChannelSlotSchema.parse(
          (request.params as { slotKey?: string }).slotKey,
        )
        reply.send(await deactivateAdminSystemChannel(slotKey))
      } catch (error) {
        handleRouteError(error, reply, 'ADMIN')
      }
    },
  )

  app.post(
    '/system-channels/:slotKey/active',
    { preHandler: mainAdminChain },
    async (request, reply) => {
      try {
        const slotKey = adminSystemChannelSlotSchema.parse(
          (request.params as { slotKey?: string }).slotKey,
        )
        const body = setAdminSystemChannelActiveSchema.parse(request.body)
        reply.send(await setAdminSystemChannelActive(slotKey, body.isActive))
      } catch (error) {
        handleRouteError(error, reply, 'ADMIN')
      }
    },
  )

  app.delete('/system-channels/:slotKey', { preHandler: mainAdminChain }, async (request, reply) => {
    try {
      const slotKey = adminSystemChannelSlotSchema.parse(
        (request.params as { slotKey?: string }).slotKey,
      )
      reply.send(await deleteAdminSystemChannel(slotKey))
    } catch (error) {
      handleRouteError(error, reply, 'ADMIN')
    }
  })

  app.get('/shop-banners', { preHandler: mainAdminChain }, async (_request, reply) => {
    try {
      reply.send(await listShopBannersAdmin())
    } catch (error) {
      handleRouteError(error, reply, 'ADMIN')
    }
  })

  app.post(
    '/shop-banners',
    {
      preHandler: mainAdminChain,
      bodyLimit: 12_000_000,
    },
    async (request, reply) => {
      try {
        reply.code(201).send(await createShopBanner(createShopBannerSchema.parse(request.body)))
      } catch (error) {
        if (error instanceof Error && error.message.includes('تصویر')) {
          reply.code(400).send({ error: 'ValidationError', message: error.message })
          return
        }
        handleRouteError(error, reply, 'ADMIN')
      }
    },
  )

  app.patch('/shop-banners/:id', { preHandler: mainAdminChain }, async (request, reply) => {
    try {
      const id = Number((request.params as { id?: string }).id)
      if (!Number.isFinite(id)) {
        reply.code(400).send({ error: 'BadRequest', message: 'Invalid id' })
        return
      }
      const result = await updateShopBanner(id, updateShopBannerSchema.parse(request.body))
      if (!result) {
        reply.code(404).send({ error: 'NotFound', message: 'Banner not found' })
        return
      }
      reply.send(result)
    } catch (error) {
      handleRouteError(error, reply, 'ADMIN')
    }
  })

  app.delete('/shop-banners/:id', { preHandler: mainAdminChain }, async (request, reply) => {
    try {
      const id = Number((request.params as { id?: string }).id)
      if (!Number.isFinite(id)) {
        reply.code(400).send({ error: 'BadRequest', message: 'Invalid id' })
        return
      }
      const result = await deleteShopBanner(id)
      if (!result) {
        reply.code(404).send({ error: 'NotFound', message: 'Banner not found' })
        return
      }
      reply.send(result)
    } catch (error) {
      handleRouteError(error, reply, 'ADMIN')
    }
  })

  app.get('/account-orders', { preHandler: mainAdminChain }, async (request, reply) => {
    try {
      reply.send(
        await listAdminAccountOrders(parseQuery(listAdminAccountOrdersQuerySchema, request.query)),
      )
    } catch (error) {
      handleRouteError(error, reply, 'ADMIN')
    }
  })

  app.get(
    '/account-orders/:orderId',
    { preHandler: mainAdminChain },
    async (request: FastifyRequest, reply) => {
      try {
        const orderId = (request.params as { orderId?: string }).orderId?.trim()
        if (!orderId) {
          reply.code(400).send({ error: 'BadRequest', message: 'Invalid order id' })
          return
        }
        const result = await getAdminAccountOrderByOrderId(orderId)
        if (!result) {
          reply.code(404).send({ error: 'NotFound', message: 'Account order not found' })
          return
        }
        reply.send(result)
      } catch (error) {
        handleRouteError(error, reply, 'ADMIN')
      }
    },
  )

  app.patch(
    '/account-orders/:orderId/status',
    { preHandler: mainAdminChain },
    async (request: FastifyRequest, reply) => {
      try {
        const orderId = (request.params as { orderId?: string }).orderId?.trim()
        if (!orderId) {
          reply.code(400).send({ error: 'BadRequest', message: 'Invalid order id' })
          return
        }
        const body = updateAdminAccountOrderStatusBodySchema.parse(request.body)
        reply.send(await updateAdminAccountOrderStatus(orderId, body))
      } catch (error) {
        handleRouteError(error, reply, 'ADMIN')
      }
    },
  )

  app.get('/account-plans', { preHandler: mainAdminChain }, async (request, reply) => {
    try {
      const query = parseQuery(listAccountShopPlansQuerySchema, request.query)
      reply.send(await listAccountShopPlansAdmin(query.categoryId))
    } catch (error) {
      handleRouteError(error, reply, 'ADMIN')
    }
  })

  app.get('/account-plans/:id', { preHandler: mainAdminChain }, async (request, reply) => {
    try {
      const id = Number((request.params as { id?: string }).id)
      if (!Number.isFinite(id)) {
        reply.code(400).send({ error: 'BadRequest', message: 'Invalid id' })
        return
      }
      const result = await getAccountShopPlanAdmin(id)
      if (!result) {
        reply.code(404).send({ error: 'NotFound', message: 'Plan not found' })
        return
      }
      reply.send(result)
    } catch (error) {
      handleRouteError(error, reply, 'ADMIN')
    }
  })

  app.post('/account-plans', { preHandler: mainAdminChain }, async (request, reply) => {
    try {
      reply.code(201).send(await createAccountShopPlan(createAccountShopPlanSchema.parse(request.body)))
    } catch (error) {
      handleRouteError(error, reply, 'ADMIN')
    }
  })

  app.patch('/account-plans/:id', { preHandler: mainAdminChain }, async (request, reply) => {
    try {
      const id = Number((request.params as { id?: string }).id)
      if (!Number.isFinite(id)) {
        reply.code(400).send({ error: 'BadRequest', message: 'Invalid id' })
        return
      }
      const result = await updateAccountShopPlan(id, updateAccountShopPlanSchema.parse(request.body))
      if (!result) {
        reply.code(404).send({ error: 'NotFound', message: 'Plan not found' })
        return
      }
      reply.send(result)
    } catch (error) {
      handleRouteError(error, reply, 'ADMIN')
    }
  })

  app.delete('/account-plans/:id', { preHandler: mainAdminChain }, async (request, reply) => {
    try {
      const id = Number((request.params as { id?: string }).id)
      if (!Number.isFinite(id)) {
        reply.code(400).send({ error: 'BadRequest', message: 'Invalid id' })
        return
      }
      const result = await deleteAccountShopPlan(id)
      if (!result) {
        reply.code(404).send({ error: 'NotFound', message: 'Plan not found' })
        return
      }
      reply.send(result)
    } catch (error) {
      handleRouteError(error, reply, 'ADMIN')
    }
  })

  app.get('/roboticvn/products', { preHandler: mainAdminChain }, async (request, reply) => {
    try {
      const query = parseQuery(roboticvnProductsQuerySchema, request.query)
      reply.send(await searchRoboticvnProductsForAdmin(query))
    } catch (error) {
      handleRouteError(error, reply, 'ADMIN')
    }
  })

  app.get('/roboticvn/products/:id', { preHandler: mainAdminChain }, async (request, reply) => {
    try {
      const id = String((request.params as { id?: string }).id ?? '').trim()
      if (!id) {
        reply.code(400).send({ error: 'BadRequest', message: 'Invalid id' })
        return
      }
      reply.send({ data: await getRoboticvnProductForAdmin(id) })
    } catch (error) {
      handleRouteError(error, reply, 'ADMIN')
    }
  })

  app.get('/settings/support-contact', { preHandler: mainAdminChain }, async (_request, reply) => {
    try {
      const telegramUsername = await getSupportTelegramUsername()
      reply.send({ telegramUsername })
    } catch (error) {
      handleRouteError(error, reply, 'ADMIN')
    }
  })

  app.put('/settings/support-contact', { preHandler: mainAdminChain }, async (request, reply) => {
    try {
      const body = z
        .object({
          telegramUsername: z.string().trim().max(64),
        })
        .parse(request.body)

      if (!body.telegramUsername) {
        await setSupportTelegramUsername('')
        reply.send({ telegramUsername: null })
        return
      }

      const telegramUsername = await setSupportTelegramUsername(body.telegramUsername)
      if (!telegramUsername) {
        reply.code(400).send({
          error: 'ValidationError',
          message: 'آیدی تلگرام معتبر نیست (مثلاً SupportTeam)',
        })
        return
      }
      reply.send({ telegramUsername })
    } catch (error) {
      handleRouteError(error, reply, 'ADMIN')
    }
  })
}
