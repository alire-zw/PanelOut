/** Power-Tel channel member service IDs */
export const TELEGRAM_MEMBER_SERVICE_IDS = [
  153, 154, 155, 156, 157, 158, 161, 162,
] as const

export type TelegramMemberServiceId = (typeof TELEGRAM_MEMBER_SERVICE_IDS)[number]

export function isTelegramMemberServiceId(value: number): value is TelegramMemberServiceId {
  return (TELEGRAM_MEMBER_SERVICE_IDS as readonly number[]).includes(value)
}

/** Power-Tel rate is per 1000 units */
export function calcTelegramMembersToman(quantity: number, rate: number): number {
  if (!Number.isFinite(quantity) || quantity <= 0) return 0
  if (!Number.isFinite(rate) || rate <= 0) return 0
  return Math.ceil((quantity / 1000) * rate)
}
