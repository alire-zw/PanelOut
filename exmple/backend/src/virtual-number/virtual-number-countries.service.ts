import type { CallinooCountryRaw } from './callinoo.client.js'
import { fetchCallinooCountries } from './callinoo.client.js'
import {
  applyPricingRule,
  getProductPricingRule,
  roundDisplayTomanUp,
} from '../pricing/product-pricing.apply.js'
import {
  flagEmojiToAlpha2,
  stripCountryEmojis,
} from './virtual-number-country.utils.js'
import {
  readCachedVirtualNumberCountries,
  writeCachedVirtualNumberCountries,
} from './virtual-number-countries.cache.js'
import type {
  VirtualNumberCountry,
  VirtualNumberCountryGroup,
  VirtualNumberQuality,
} from './virtual-number-countries.types.js'
import {
  VIRTUAL_NUMBER_QUALITY_LABELS,
  VIRTUAL_NUMBER_QUALITY_ORDER,
} from './virtual-number-countries.types.js'

const PREMIUM_PRICE_THRESHOLD = 400_000
const STANDARD_PRICE_THRESHOLD = 150_000

function parseRange(value: number | string): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10)
  return Number.isFinite(parsed) ? parsed : 0
}

export function isCallinooCountryAvailable(count: string): boolean {
  const value = count.trim()
  if (!value) return false
  if (
    value.includes('❌') ||
    value.includes('✖') ||
    value.includes('ناموجود') ||
    value.includes('تمام') ||
    value.includes('unavailable')
  ) {
    return false
  }

  return value.includes('✅') || value.includes('موجود') || value.includes('available')
}

function resolveQuality(price: number): VirtualNumberQuality {
  if (price >= PREMIUM_PRICE_THRESHOLD) {
    return 'premium'
  }

  if (price >= STANDARD_PRICE_THRESHOLD) {
    return 'standard'
  }

  return 'economy'
}

function sortCountries(items: VirtualNumberCountry[]): VirtualNumberCountry[] {
  return [...items].sort((left, right) => {
    if (left.available !== right.available) {
      return left.available ? -1 : 1
    }

    if (left.price !== right.price) {
      return left.price - right.price
    }

    return left.country.localeCompare(right.country, 'fa')
  })
}

function mapCountry(item: CallinooCountryRaw): VirtualNumberCountry | null {
  const range = parseRange(item.range)
  if (range <= 0) {
    return null
  }

  const price = Number(item.price)
  if (!Number.isFinite(price) || price <= 0) {
    return null
  }

  const flagCode = flagEmojiToAlpha2(item.emoji || item.country)
  if (!flagCode) {
    return null
  }

  const country = stripCountryEmojis(item.country)
  if (!country) {
    return null
  }

  return {
    countryId: String(range),
    country,
    flagCode,
    range,
    price,
    toman: roundDisplayTomanUp(price),
    quality: resolveQuality(price),
    available: isCallinooCountryAvailable(item.count),
  }
}

function buildGroups(countries: VirtualNumberCountry[]): VirtualNumberCountryGroup[] {
  const grouped = new Map<VirtualNumberQuality, VirtualNumberCountry[]>()

  for (const quality of VIRTUAL_NUMBER_QUALITY_ORDER) {
    grouped.set(quality, [])
  }

  for (const country of countries) {
    grouped.get(country.quality)?.push(country)
  }

  return VIRTUAL_NUMBER_QUALITY_ORDER.map((quality) => ({
    quality,
    label: VIRTUAL_NUMBER_QUALITY_LABELS[quality],
    items: sortCountries(grouped.get(quality) ?? []),
  })).filter((group) => group.items.length > 0)
}

/** Live Callinoo fetch → replace Redis snapshot. Used by cron / cold start only. */
export async function refreshVirtualNumberCountryGroups(
  noneReport = true,
): Promise<VirtualNumberCountryGroup[]> {
  const rawCountries = await fetchCallinooCountries(noneReport)
  const countries = rawCountries
    .map(mapCountry)
    .filter((item): item is VirtualNumberCountry => item !== null)

  const groups = buildGroups(countries)
  await writeCachedVirtualNumberCountries(noneReport, groups)
  return withVirtualNumberPricing(groups)
}

async function withVirtualNumberPricing(
  groups: VirtualNumberCountryGroup[],
): Promise<VirtualNumberCountryGroup[]> {
  const rule = await getProductPricingRule('virtual-number')
  return groups.map((group) => ({
    ...group,
    items: group.items.map((item) => ({
      ...item,
      // Keep Callinoo base in `price`; put admin-adjusted display price in `toman`.
      toman: applyPricingRule(item.price, rule),
    })),
  }))
}

/**
 * Serve countries/prices/availability from Redis cache.
 * Only hits Callinoo when the cache is empty (cold start).
 * Cron refreshes the snapshot every ~10 minutes.
 */
export async function getVirtualNumberCountryGroups(
  noneReport = true,
): Promise<{ groups: VirtualNumberCountryGroup[]; cached: boolean }> {
  const cached = await readCachedVirtualNumberCountries(noneReport)
  if (cached) {
    return { groups: await withVirtualNumberPricing(cached), cached: true }
  }

  const groups = await refreshVirtualNumberCountryGroups(noneReport)
  return { groups, cached: false }
}

/** Resolve a country from the cached catalog (no live Callinoo call). */
export async function findLiveVirtualNumberCountry(
  countryId: string,
  noneReport = true,
): Promise<VirtualNumberCountry | null> {
  const { groups } = await getVirtualNumberCountryGroups(noneReport)
  return groups.flatMap((group) => group.items).find((item) => item.countryId === countryId) ?? null
}

export async function markVirtualNumberCountryUnavailable(
  countryId: string,
  noneReport = true,
): Promise<void> {
  const cached = await readCachedVirtualNumberCountries(noneReport)
  if (!cached) return

  let changed = false
  const next = cached.map((group) => ({
    ...group,
    items: group.items.map((item) => {
      if (item.countryId !== countryId || item.available === false) return item
      changed = true
      return { ...item, available: false }
    }),
  }))

  if (changed) {
    await writeCachedVirtualNumberCountries(noneReport, next)
  }
}
