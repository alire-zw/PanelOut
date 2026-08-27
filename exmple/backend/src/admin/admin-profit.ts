import { calcChannelViewsToman } from '../channel-views/channel-views.pricing.js'
import { calcReactionItemToman } from '../reaction/reaction-pricing.js'
import { calcTelegramMembersToman } from '../telegram-members/telegram-members.pricing.js'

export type PricingRuleSnap = {
  markupPercent: number
  fixedAddToman: number
  isActive: boolean
}

export type AccountPlanSnap = {
  pricingMode: string
  markupPercent: number
}

/** Invert sell ≈ base*(1+markup/100)+fixed (ignores display rounding). */
export function estimateBaseFromSell(
  sellToman: number,
  rule: PricingRuleSnap | null | undefined,
): number | null {
  if (!Number.isFinite(sellToman) || sellToman <= 0) return null
  if (!rule || !rule.isActive) return sellToman

  const markup = Number.isFinite(rule.markupPercent) ? rule.markupPercent : 0
  const fixed = Number.isFinite(rule.fixedAddToman) ? Math.max(0, rule.fixedAddToman) : 0
  if (markup <= -100) return null

  const base = (sellToman - fixed) / (1 + markup / 100)
  if (!Number.isFinite(base) || base < 0) return null
  return Math.round(base)
}

function parseReactionBaseCost(itemsJson: unknown): number | null {
  if (!Array.isArray(itemsJson)) return null
  let total = 0
  let any = false

  for (const item of itemsJson) {
    if (typeof item !== 'object' || item === null) continue
    const record = item as Record<string, unknown>
    const quantity = Number(record.quantity)
    const rate = Number(record.rate)
    const stored = Number(record.toman)

    if (Number.isFinite(stored) && stored > 0) {
      total += stored
      any = true
      continue
    }

    if (Number.isFinite(quantity) && Number.isFinite(rate)) {
      total += calcReactionItemToman(quantity, rate)
      any = true
    }
  }

  return any ? total : null
}

export type OrderCostInput = {
  slug: string
  amountToman: number
  virtualNumberPrice?: number | null
  reactionItemsJson?: unknown
  channelView?: { quantity: number; rate: number } | null
  telegramMember?: { quantity: number; rate: number } | null
  accountPlan?: AccountPlanSnap | null
  pricingRule?: PricingRuleSnap | null
}

/**
 * Estimate provider/base cost for a paid order from DB snapshots + pricing rules.
 * Returns null when cost cannot be inferred (e.g. fixed account plans without cost snapshot).
 */
export function estimateOrderCostToman(input: OrderCostInput): number | null {
  const sell = input.amountToman
  if (!Number.isFinite(sell) || sell <= 0) return null

  switch (input.slug) {
    case 'virtual-number': {
      const price = input.virtualNumberPrice
      if (price == null || !Number.isFinite(price) || price < 0) return null
      return Math.round(price)
    }
    case 'channel-views': {
      const cv = input.channelView
      if (!cv) return null
      return calcChannelViewsToman(cv.quantity, cv.rate)
    }
    case 'telegram-members': {
      const tm = input.telegramMember
      if (!tm) return null
      return calcTelegramMembersToman(tm.quantity, tm.rate)
    }
    case 'reaction': {
      return parseReactionBaseCost(input.reactionItemsJson)
    }
    case 'chatgpt': {
      const plan = input.accountPlan
      if (!plan) {
        return estimateBaseFromSell(sell, input.pricingRule)
      }
      if (plan.pricingMode === 'variable') {
        return estimateBaseFromSell(sell, {
          markupPercent: plan.markupPercent,
          fixedAddToman: 0,
          isActive: true,
        })
      }
      // Fixed sell price: provider cost is not stored on the order.
      return null
    }
    case 'telegram-stars':
    case 'telegram-premium':
      return estimateBaseFromSell(sell, input.pricingRule)
    default:
      return estimateBaseFromSell(sell, input.pricingRule)
  }
}

export type ProfitBucket = {
  revenueToman: number
  costToman: number
  profitToman: number
  orderCount: number
  knownCostCount: number
  unknownCostCount: number
}

export function emptyProfitBucket(): ProfitBucket {
  return {
    revenueToman: 0,
    costToman: 0,
    profitToman: 0,
    orderCount: 0,
    knownCostCount: 0,
    unknownCostCount: 0,
  }
}

export function addOrderToProfitBucket(
  bucket: ProfitBucket,
  revenue: number,
  cost: number | null,
): void {
  bucket.orderCount += 1
  bucket.revenueToman += revenue
  if (cost == null) {
    bucket.unknownCostCount += 1
    return
  }
  bucket.knownCostCount += 1
  bucket.costToman += cost
  bucket.profitToman += revenue - cost
}

export function serializeProfitBucket(bucket: ProfitBucket) {
  return {
    revenueToman: String(Math.round(bucket.revenueToman)),
    costToman: String(Math.round(bucket.costToman)),
    profitToman: String(Math.round(bucket.profitToman)),
    orderCount: bucket.orderCount,
    knownCostCount: bucket.knownCostCount,
    unknownCostCount: bucket.unknownCostCount,
  }
}
