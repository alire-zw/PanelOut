import { redis } from '../redis/client.js'
import type { CachedUserOrders } from './user-orders.types.js'

const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60

function buildCacheKey(userId: number): string {
  return `orders:me:v1:${userId}`
}

export async function readUserOrdersCache(userId: number): Promise<CachedUserOrders | null> {
  const raw = await redis.get(buildCacheKey(userId))
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as CachedUserOrders
    if (!parsed?.version || !Array.isArray(parsed.items)) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export async function writeUserOrdersCache(userId: number, payload: CachedUserOrders): Promise<void> {
  await redis.set(buildCacheKey(userId), JSON.stringify(payload), 'EX', CACHE_TTL_SECONDS)
}

export async function invalidateUserOrdersCache(userId: number): Promise<void> {
  await redis.del(buildCacheKey(userId))
}
