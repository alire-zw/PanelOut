import { log } from '../lib/logger.js'
import { prisma } from '../db/client.js'
import { invalidateWalletTransactionsCache } from '../wallet/wallet-transaction.service.js'
import { updateOrderStatus } from '../orders/order.service.js'
import { failOrderAndRefundMixedWallet } from '../orders/order-wallet-refund.js'
import { buyPremium } from '../stars/marketapp.client.js'
import { notifyOrderCompleted } from '../bot/notifications/order-report.js'

export class PremiumPurchaseError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'PRICE_CHANGED'
      | 'INSUFFICIENT_BALANCE'
      | 'FULFILLMENT_FAILED'
      | 'ORDER_NOT_FOUND',
  ) {
    super(message)
    this.name = 'PremiumPurchaseError'
  }
}

export async function fulfillPremiumOrder(orderId: string): Promise<boolean> {
  const order = await prisma.order.findUnique({
    where: { orderId },
    include: { category: true },
  })

  if (!order) {
    return false
  }

  if (order.status === 'completed') {
    return true
  }

  if (order.category.slug !== 'telegram-premium') {
    return false
  }

  if (!order.recipientUsername || !order.quantity) {
    throw new PremiumPurchaseError('اطلاعات سفارش ناقص است', 'ORDER_NOT_FOUND')
  }

  const months = order.quantity
  if (months !== 3 && months !== 6 && months !== 12) {
    throw new PremiumPurchaseError('مدت اشتراک نامعتبر است', 'ORDER_NOT_FOUND')
  }

  await updateOrderStatus(order.id, 'processing')

  try {
    await buyPremium({
      username: order.recipientUsername,
      months,
    })

    await updateOrderStatus(order.id, 'completed', { fulfilledAt: new Date() })

    log.info('PREMIUM', 'order fulfilled', {
      orderId: order.orderId,
      userId: order.userId,
      username: order.recipientUsername,
      months,
      method: order.paymentMethod,
    })

    void invalidateWalletTransactionsCache(order.userId)
    void notifyOrderCompleted(order.orderId)

    return true
  } catch (error) {
    await failOrderAndRefundMixedWallet(order.id)

    log.error('PREMIUM', 'order fulfillment failed', {
      orderId: order.orderId,
      error: error instanceof Error ? error.message : 'unknown',
    })

    throw new PremiumPurchaseError('خطا در ثبت خرید پریمیوم', 'FULFILLMENT_FAILED')
  }
}

export async function fulfillShopOrder(orderId: string): Promise<boolean> {
  const order = await prisma.order.findUnique({
    where: { orderId },
    include: { category: true },
  })

  if (!order) {
    return false
  }

  if (order.category.slug === 'telegram-stars') {
    const { fulfillStarsOrder } = await import('../stars/stars-purchase.fulfillment.js')
    return fulfillStarsOrder(orderId)
  }

  if (order.category.slug === 'telegram-premium') {
    return fulfillPremiumOrder(orderId)
  }

  if (order.category.slug === 'virtual-number') {
    const { fulfillVirtualNumberOrder } = await import(
      '../virtual-number/virtual-number-purchase.fulfillment.js'
    )
    return fulfillVirtualNumberOrder(orderId)
  }

  if (order.category.slug === 'reaction') {
    const { fulfillReactionOrder } = await import('../reaction/reaction-purchase.fulfillment.js')
    return fulfillReactionOrder(orderId)
  }

  if (order.category.slug === 'channel-views') {
    const { fulfillChannelViewsOrder } = await import(
      '../channel-views/channel-views-purchase.fulfillment.js'
    )
    return fulfillChannelViewsOrder(orderId)
  }

  if (order.category.slug === 'telegram-members') {
    const { fulfillTelegramMembersOrder } = await import(
      '../telegram-members/telegram-members-purchase.fulfillment.js'
    )
    return fulfillTelegramMembersOrder(orderId)
  }

  if (order.category.slug === 'chatgpt') {
    const { fulfillAccountShopOrder } = await import(
      '../chatgpt/account-shop-purchase.fulfillment.js'
    )
    return fulfillAccountShopOrder(orderId)
  }

  return false
}
