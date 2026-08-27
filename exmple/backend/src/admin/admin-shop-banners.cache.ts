import { createHash } from 'node:crypto'
import { redis } from '../redis/client.js'
import type { ShopBannerDto } from './admin-shop-banners.service.js'

const CACHE_KEY = 'shop:banners:active:v1'
const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60

export type ShopBannersPayload = {
  version: string
  cachedAt: string
  items: ShopBannerDto[]
}

export function buildShopBannersVersion(items: ShopBannerDto[]): string {
  const fingerprint = items
    .map(
      (item) =>
        `${item.id}:${item.productKey}:${item.mainImageUrl}:${item.thumbImageUrl}:${item.sortOrder}:${item.isActive ? 1 : 0}:${item.updatedAt}`,
    )
    .join('|')
  return createHash('sha256').update(fingerprint).digest('hex').slice(0, 24)
}

export async function readActiveShopBannersCache(): Promise<ShopBannersPayload | null> {
  const raw = await redis.get(CACHE_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as ShopBannersPayload
    if (!parsed?.version || !Array.isArray(parsed.items)) return null
    return parsed
  } catch {
    return null
  }
}

export async function writeActiveShopBannersCache(payload: ShopBannersPayload): Promise<void> {
  await redis.set(CACHE_KEY, JSON.stringify(payload), 'EX', CACHE_TTL_SECONDS)
}

export async function invalidateActiveShopBannersCache(): Promise<void> {
  await redis.del(CACHE_KEY)
}
