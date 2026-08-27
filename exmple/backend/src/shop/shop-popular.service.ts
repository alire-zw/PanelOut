import { prisma } from '../db/client.js'
import { redis } from '../redis/client.js'
import {
  ACCOUNT_SHOP_CATEGORIES,
  parseAccountShopProductKey,
} from '../chatgpt/account-shop.catalog.js'
import { SHOP_CATEGORIES } from '../orders/shop-category.data.js'
import { SHOP_PRODUCT_KEYS } from '../analytics/analytics.schema.js'

const CACHE_KEY = 'shop:popular:v3'
const CACHE_TTL_SECONDS = 10 * 60
const LIMIT = 12

export type ShopPopularItem = {
  productKey: string
  label: string
  count: number
}

export type ShopPopularPayload = {
  bestsellers: ShopPopularItem[]
  mostViewed: ShopPopularItem[]
  cachedAt: string
}

function labelFor(productKey: string): string {
  const accountId = parseAccountShopProductKey(productKey)
  if (accountId) {
    return (
      ACCOUNT_SHOP_CATEGORIES.find((item) => item.id === accountId)?.labelFa ?? productKey
    )
  }
  return SHOP_CATEGORIES.find((item) => item.slug === productKey)?.label ?? productKey
}

function normalizeProductKey(raw: string): string | null {
  const key = raw.trim().toLowerCase()
  if (!key) return null
  if (SHOP_PRODUCT_KEYS.includes(key)) {
    return key
  }
  const root = key.split(':')[0] ?? ''
  if (root && SHOP_PRODUCT_KEYS.includes(root)) {
    return root
  }
  return null
}

/** Keep sold/viewed items first, then fill remaining slots from the full catalog. */
function padWithCatalog(items: ShopPopularItem[], limit = LIMIT): ShopPopularItem[] {
  const seen = new Set(items.map((item) => item.productKey))
  const padded = [...items]

  for (const productKey of SHOP_PRODUCT_KEYS) {
    if (padded.length >= limit) break
    if (seen.has(productKey)) continue
    seen.add(productKey)
    padded.push({
      productKey,
      label: labelFor(productKey),
      count: 0,
    })
  }

  return padded.slice(0, limit)
}

async function readCache(): Promise<ShopPopularPayload | null> {
  try {
    const raw = await redis.get(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ShopPopularPayload
    if (!Array.isArray(parsed?.bestsellers) || !Array.isArray(parsed?.mostViewed)) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

async function writeCache(payload: ShopPopularPayload): Promise<void> {
  try {
    await redis.set(CACHE_KEY, JSON.stringify(payload), 'EX', CACHE_TTL_SECONDS)
  } catch {
    // ignore cache write failures
  }
}

async function loadBestsellers(): Promise<ShopPopularItem[]> {
  const rows = await prisma.order.groupBy({
    by: ['categoryId'],
    where: {
      OR: [
        { status: 'completed' },
        { status: 'processing', category: { slug: 'chatgpt' } },
      ],
    },
    _count: { _all: true },
  })

  if (rows.length === 0) {
    return []
  }

  rows.sort((left, right) => right._count._all - left._count._all)

  const categories = await prisma.shopCategory.findMany({
    where: {
      id: { in: rows.map((row) => row.categoryId) },
      isActive: true,
    },
    select: { id: true, slug: true, label: true },
  })
  const byId = new Map(categories.map((item) => [item.id, item]))

  const items: ShopPopularItem[] = []
  for (const row of rows) {
    const category = byId.get(row.categoryId)
    if (!category) continue
    const productKey = normalizeProductKey(category.slug)
    if (!productKey) continue
    items.push({
      productKey,
      label: category.label || labelFor(productKey),
      count: row._count._all,
    })
    if (items.length >= LIMIT) break
  }

  return items
}

async function loadMostViewed(): Promise<ShopPopularItem[]> {
  const rows = await prisma.productViewStat.findMany({
    orderBy: { viewCount: 'desc' },
    take: LIMIT * 3,
  })

  const merged = new Map<string, number>()
  for (const row of rows) {
    const productKey = normalizeProductKey(row.productKey)
    if (!productKey) continue
    merged.set(productKey, (merged.get(productKey) ?? 0) + Number(row.viewCount))
  }

  return [...merged.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, LIMIT)
    .map(([productKey, count]) => ({
      productKey,
      label: labelFor(productKey),
      count,
    }))
}

function fallbackItems(): ShopPopularItem[] {
  return SHOP_CATEGORIES.slice(0, 8).map((item) => ({
    productKey: item.slug,
    label: item.label,
    count: 0,
  }))
}

export async function getShopPopularProducts(): Promise<ShopPopularPayload> {
  const cached = await readCache()
  if (cached) {
    return cached
  }

  const [bestsellersRaw, mostViewedRaw] = await Promise.all([
    loadBestsellers(),
    loadMostViewed(),
  ])

  const fallback = fallbackItems()
  const payload: ShopPopularPayload = {
    bestsellers: padWithCatalog(bestsellersRaw.length > 0 ? bestsellersRaw : fallback),
    mostViewed: padWithCatalog(mostViewedRaw.length > 0 ? mostViewedRaw : fallback),
    cachedAt: new Date().toISOString(),
  }

  await writeCache(payload)
  return payload
}
