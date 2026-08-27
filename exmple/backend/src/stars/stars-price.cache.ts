import { redis } from '../redis/client.js'
import type { StarsPriceResponse } from './marketapp.client.js'

export const STARS_PRICE_CACHE_TTL_SECONDS = 10 * 60

const TON_IRT_CACHE_KEY = 'stars:price:ton-irt'

function buildMarketPriceCacheKey(quantity: number): string {
  return `stars:price:market:${quantity}`
}

function isValidMarketPrice(value: unknown): value is StarsPriceResponse {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const record = value as Record<string, unknown>
  return (
    typeof record.ton === 'number' &&
    Number.isFinite(record.ton) &&
    typeof record.gram === 'number' &&
    Number.isFinite(record.gram)
  )
}

export async function readCachedTonIrtPrice(): Promise<number | null> {
  const raw = await redis.get(TON_IRT_CACHE_KEY)
  if (!raw) return null

  const price = Number.parseFloat(raw)
  if (!Number.isFinite(price) || price <= 0) {
    return null
  }

  return price
}

export async function writeCachedTonIrtPrice(price: number): Promise<void> {
  await redis.set(TON_IRT_CACHE_KEY, String(price), 'EX', STARS_PRICE_CACHE_TTL_SECONDS)
}

export async function readCachedMarketPrice(quantity: number): Promise<StarsPriceResponse | null> {
  const raw = await redis.get(buildMarketPriceCacheKey(quantity))
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!isValidMarketPrice(parsed)) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

export async function writeCachedMarketPrice(
  quantity: number,
  price: StarsPriceResponse,
): Promise<void> {
  await redis.set(
    buildMarketPriceCacheKey(quantity),
    JSON.stringify(price),
    'EX',
    STARS_PRICE_CACHE_TTL_SECONDS,
  )
}
