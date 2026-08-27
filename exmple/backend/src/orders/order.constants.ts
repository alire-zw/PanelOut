export const STARS_ORDER_ID_OFFSET = 100_000
export const PREMIUM_ORDER_ID_OFFSET = 100_000
export const VIRTUAL_NUMBER_ORDER_ID_OFFSET = 100_000
export const REACTION_ORDER_ID_OFFSET = 100_000
export const CHANNEL_VIEWS_ORDER_ID_OFFSET = 100_000
export const TELEGRAM_MEMBERS_ORDER_ID_OFFSET = 100_000
export const ACCOUNT_SHOP_ORDER_ID_OFFSET = 100_000

export function buildStarsOrderId(orderDbId: number): string {
  return `SB-${STARS_ORDER_ID_OFFSET + orderDbId}`
}

export function buildPremiumOrderId(orderDbId: number): string {
  return `PB-${PREMIUM_ORDER_ID_OFFSET + orderDbId}`
}

export function buildVirtualNumberOrderId(orderDbId: number): string {
  return `VB-${VIRTUAL_NUMBER_ORDER_ID_OFFSET + orderDbId}`
}

export function buildReactionOrderId(orderDbId: number): string {
  return `RB-${REACTION_ORDER_ID_OFFSET + orderDbId}`
}

export function buildChannelViewsOrderId(orderDbId: number): string {
  return `CV-${CHANNEL_VIEWS_ORDER_ID_OFFSET + orderDbId}`
}

export function buildTelegramMembersOrderId(orderDbId: number): string {
  return `TM-${TELEGRAM_MEMBERS_ORDER_ID_OFFSET + orderDbId}`
}

export function buildAccountShopOrderId(orderDbId: number): string {
  return `AC-${ACCOUNT_SHOP_ORDER_ID_OFFSET + orderDbId}`
}
