/** Power-Tel service 1 — ویو فیک #آنی (ارزان) */
export const CHANNEL_VIEW_SERVICE_ID = 1 as const

/** Power-Tel rate is per 1000 units */
export function calcChannelViewsToman(quantity: number, rate: number): number {
  if (!Number.isFinite(quantity) || quantity <= 0) return 0
  if (!Number.isFinite(rate) || rate <= 0) return 0
  return Math.ceil((quantity / 1000) * rate)
}

/**
 * Proportional jitter range for auto views.
 * ~10% around 60 views (±6), easing toward ~5% at higher counts (±30 around 600).
 */
export function calcChannelViewsRandomizeRange(quantity: number): number {
  if (!Number.isFinite(quantity) || quantity <= 0) return 1
  const percent = Math.min(0.1, Math.max(0.05, 0.1 * Math.sqrt(60 / quantity)))
  return Math.max(1, Math.round(quantity * percent))
}

export function applyChannelViewsRandomize(quantity: number): number {
  const range = calcChannelViewsRandomizeRange(quantity)
  const delta = Math.floor(Math.random() * (range * 2 + 1)) - range
  return quantity + delta
}
