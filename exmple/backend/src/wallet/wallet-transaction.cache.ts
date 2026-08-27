import { redis } from '../redis/client.js'
import type { CachedWalletTransactions } from './wallet-transaction.types.js'

const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60

function buildCacheKey(userId: number): string {
  return `wallet:transactions:v2:${userId}`
}

export async function readWalletTransactionsCache(
  userId: number,
): Promise<CachedWalletTransactions | null> {
  const raw = await redis.get(buildCacheKey(userId))
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as CachedWalletTransactions
    if (!parsed?.version || !Array.isArray(parsed.items)) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export async function writeWalletTransactionsCache(
  userId: number,
  payload: CachedWalletTransactions,
): Promise<void> {
  await redis.set(buildCacheKey(userId), JSON.stringify(payload), 'EX', CACHE_TTL_SECONDS)
}

export async function invalidateWalletTransactionsCache(userId: number): Promise<void> {
  await redis.del(buildCacheKey(userId))
}
