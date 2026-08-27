import { redis } from '../redis/client.js'
import type { PremiumPriceItem } from '../stars/marketapp.client.js'

export const PREMIUM_PRICE_CACHE_TTL_SECONDS = 10 * 60

const PREMIUM_PRICES_CACHE_KEY = 'premium:price:all'

function isValidPremiumPrices(value: unknown): value is PremiumPriceItem[] {
  if (!Array.isArray(value) || value.length !== 3) {
    return false
  }

  return value.every(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      (item.months === 3 || item.months === 6 || item.months === 12) &&
      typeof item.ton === 'number' &&
      Number.isFinite(item.ton) &&
      typeof item.gram === 'number' &&
      Number.isFinite(item.gram),
  )
}

export async function readCachedPremiumPrices(): Promise<PremiumPriceItem[] | null> {
  const raw = await redis.get(PREMIUM_PRICES_CACHE_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!isValidPremiumPrices(parsed)) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

export async function writeCachedPremiumPrices(items: PremiumPriceItem[]): Promise<void> {
  await redis.set(
    PREMIUM_PRICES_CACHE_KEY,
    JSON.stringify(items),
    'EX',
    PREMIUM_PRICE_CACHE_TTL_SECONDS,
  )
}
