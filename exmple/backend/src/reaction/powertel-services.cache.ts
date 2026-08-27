import { redis } from '../redis/client.js'
import type { PowerTelService } from './powertel.client.js'

export const POWERTEL_SERVICES_CACHE_TTL_SECONDS = 10 * 60

const CACHE_KEY = 'powertel:services:v1'

function isValidServices(value: unknown): value is PowerTelService[] {
  if (!Array.isArray(value) || value.length === 0) return false

  return value.every(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      typeof item.service === 'number' &&
      typeof item.rate === 'number' &&
      typeof item.min === 'number' &&
      typeof item.max === 'number',
  )
}

export async function readCachedPowerTelServices(): Promise<PowerTelService[] | null> {
  const raw = await redis.get(CACHE_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as unknown
    return isValidServices(parsed) ? parsed : null
  } catch {
    return null
  }
}

export async function writeCachedPowerTelServices(services: PowerTelService[]): Promise<void> {
  await redis.set(CACHE_KEY, JSON.stringify(services), 'EX', POWERTEL_SERVICES_CACHE_TTL_SECONDS)
}
