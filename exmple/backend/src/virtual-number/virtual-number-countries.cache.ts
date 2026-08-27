import { redis } from '../redis/client.js'
import type { VirtualNumberCountry, VirtualNumberCountryGroup } from './virtual-number-countries.types.js'

/** Keep TTL longer than the cron interval so the cache never goes empty between refreshes. */
export const VIRTUAL_NUMBER_COUNTRIES_CACHE_TTL_SECONDS = 15 * 60

const CACHE_KEY_PREFIX = 'virtual-number:countries:v7'

function buildCacheKey(noneReport: boolean): string {
  return `${CACHE_KEY_PREFIX}:${noneReport ? 'clean' : 'all'}`
}

function isValidGroups(value: unknown): value is VirtualNumberCountryGroup[] {
  if (!Array.isArray(value) || value.length === 0) {
    return false
  }

  return value.every(
    (group) =>
      typeof group === 'object' &&
      group !== null &&
      typeof group.quality === 'string' &&
      typeof group.label === 'string' &&
      Array.isArray(group.items) &&
      group.items.every(
        (item: VirtualNumberCountry) =>
          typeof item === 'object' &&
          item !== null &&
          typeof item.countryId === 'string' &&
          typeof item.country === 'string' &&
          typeof item.flagCode === 'string' &&
          typeof item.price === 'number' &&
          typeof item.toman === 'number' &&
          typeof item.available === 'boolean',
      ),
  )
}

export async function readCachedVirtualNumberCountries(
  noneReport: boolean,
): Promise<VirtualNumberCountryGroup[] | null> {
  const raw = await redis.get(buildCacheKey(noneReport))
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!isValidGroups(parsed)) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

export async function clearCachedVirtualNumberCountries(noneReport?: boolean): Promise<void> {
  if (noneReport === undefined) {
    await redis.del(buildCacheKey(true), buildCacheKey(false))
    return
  }

  await redis.del(buildCacheKey(noneReport))
}

export async function writeCachedVirtualNumberCountries(
  noneReport: boolean,
  groups: VirtualNumberCountryGroup[],
): Promise<void> {
  // Replace previous snapshot for this key (delete then set with TTL).
  await clearCachedVirtualNumberCountries(noneReport)
  await redis.set(
    buildCacheKey(noneReport),
    JSON.stringify(groups),
    'EX',
    VIRTUAL_NUMBER_COUNTRIES_CACHE_TTL_SECONDS,
  )
}
