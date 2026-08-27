import { prisma } from '../db/client.js'

export type ProductPricingRule = {
  productKey: string
  markupPercent: number
  fixedAddToman: number
  isActive: boolean
}

const CACHE_TTL_MS = 60_000
let rulesCache: { at: number; byKey: Map<string, ProductPricingRule> } | null = null

/** Round display toman up for user-facing prices. */
export function roundDisplayTomanUp(toman: number): number {
  if (!Number.isFinite(toman) || toman <= 0) return 0
  const value = Math.ceil(toman)
  if (value >= 10_000) return Math.ceil(value / 1_000) * 1_000
  return Math.ceil(value / 100) * 100
}

export function invalidateProductPricingCache(): void {
  rulesCache = null
}

async function loadRulesMap(): Promise<Map<string, ProductPricingRule>> {
  const now = Date.now()
  if (rulesCache && now - rulesCache.at < CACHE_TTL_MS) {
    return rulesCache.byKey
  }

  const rows = await prisma.productPricing.findMany({
    where: { isActive: true },
  })

  const byKey = new Map<string, ProductPricingRule>()
  for (const row of rows) {
    byKey.set(row.productKey, {
      productKey: row.productKey,
      markupPercent: row.markupPercent,
      fixedAddToman: Number(row.fixedAddToman),
      isActive: row.isActive,
    })
  }

  rulesCache = { at: now, byKey }
  return byKey
}

export async function loadActivePricingRules(): Promise<ProductPricingRule[]> {
  const map = await loadRulesMap()
  return [...map.values()]
}

export async function getProductPricingRule(
  productKey: string,
): Promise<ProductPricingRule | null> {
  const map = await loadRulesMap()
  return map.get(productKey) ?? null
}

/**
 * Apply admin markup % and fixed تومان add, then round for display/charge.
 * Formula: base * (1 + markup/100) + fixed
 */
export function applyPricingRule(
  baseToman: number,
  rule: ProductPricingRule | null | undefined,
): number {
  if (!Number.isFinite(baseToman) || baseToman <= 0) return 0
  if (!rule || !rule.isActive) {
    return roundDisplayTomanUp(baseToman)
  }

  const markup = Number.isFinite(rule.markupPercent) ? rule.markupPercent : 0
  const fixed = Number.isFinite(rule.fixedAddToman) ? Math.max(0, rule.fixedAddToman) : 0
  const withMarkup = baseToman * (1 + markup / 100) + fixed
  return roundDisplayTomanUp(withMarkup)
}

export async function applyProductPricing(
  productKey: string,
  baseToman: number,
): Promise<number> {
  const rule = await getProductPricingRule(productKey)
  return applyPricingRule(baseToman, rule)
}
