import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  listActiveShopBanners,
  syncActiveShopBanners,
} from '../../admin/admin-shop-banners.service.js'
import { getProductPricingRule, loadActivePricingRules } from '../../pricing/product-pricing.apply.js'
import { getShopPopularProducts } from '../../shop/shop-popular.service.js'
import { telegramAuthMiddleware } from '../middleware/telegram-auth.js'
import { requireUserMiddleware } from '../middleware/require-user.js'

export async function shopPricingRoutes(app: FastifyInstance): Promise<void> {
  const authChain = [telegramAuthMiddleware, requireUserMiddleware]

  // Public: shop home banners must load even before/without auth session.
  app.get('/banners', async (_request, reply) => {
    reply.send(await listActiveShopBanners())
  })

  app.post('/banners/sync', async (request, reply) => {
    const body = z
      .object({
        version: z.string().trim().min(1).max(64).optional(),
      })
      .parse(request.body ?? {})
    reply.send(await syncActiveShopBanners(body.version))
  })

  app.get('/popular', async (_request, reply) => {
    reply.send(await getShopPopularProducts())
  })

  app.get('/pricing', { preHandler: authChain }, async (_request, reply) => {
    const rules = await loadActivePricingRules()
    reply.send({
      items: rules.map((rule) => ({
        productKey: rule.productKey,
        markupPercent: rule.markupPercent,
        fixedAddToman: rule.fixedAddToman,
      })),
    })
  })

  app.get('/pricing/:productKey', { preHandler: authChain }, async (request, reply) => {
    const { productKey } = request.params as { productKey: string }
    const rule = await getProductPricingRule(productKey)
    reply.send({
      productKey,
      markupPercent: rule?.markupPercent ?? 0,
      fixedAddToman: rule?.fixedAddToman ?? 0,
    })
  })
}
