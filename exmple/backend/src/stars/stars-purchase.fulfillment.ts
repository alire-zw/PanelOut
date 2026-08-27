import { log } from '../lib/logger.js'
import { prisma } from '../db/client.js'
import { invalidateWalletTransactionsCache } from '../wallet/wallet-transaction.service.js'
import { buyStars } from './marketapp.client.js'
import { failOrderAndRefundMixedWallet } from '../orders/order-wallet-refund.js'
import { updateOrderStatus } from '../orders/order.service.js'
import { notifyOrderCompleted } from '../bot/notifications/order-report.js'

export class StarsPurchaseError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'PRICE_CHANGED'
      | 'INSUFFICIENT_BALANCE'
      | 'FULFILLMENT_FAILED'
      | 'ORDER_NOT_FOUND',
  ) {
    super(message)
    this.name = 'StarsPurchaseError'
  }
}

export async function isStarsPurchaseOrder(orderId: string): Promise<boolean> {
  if (!orderId.startsWith('SB-')) {
    return false
  }

  const order = await prisma.order.findUnique({ where: { orderId } })
  return order != null
}

export async function isStarsPurchasePayment(paymentId: number): Promise<boolean> {
  const order = await prisma.order.findFirst({ where: { paymentId } })
  return order != null
}

export async function isStarsPurchaseCryptoPayment(cryptoPaymentId: number): Promise<boolean> {
  const order = await prisma.order.findFirst({ where: { cryptoPaymentId } })
  return order != null
}

export async function fulfillStarsOrder(orderId: string): Promise<boolean> {
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

  if (order.category.slug !== 'telegram-stars') {
    return false
  }

  if (!order.recipientUsername || !order.quantity) {
    throw new StarsPurchaseError('اطلاعات سفارش ناقص است', 'ORDER_NOT_FOUND')
  }

  await updateOrderStatus(order.id, 'processing')

  try {
    await buyStars({
      username: order.recipientUsername,
      quantity: order.quantity,
    })

    await updateOrderStatus(order.id, 'completed', { fulfilledAt: new Date() })

    log.info('STARS', 'order fulfilled', {
      orderId: order.orderId,
      userId: order.userId,
      username: order.recipientUsername,
      quantity: order.quantity,
      method: order.paymentMethod,
    })

    void invalidateWalletTransactionsCache(order.userId)
    void notifyOrderCompleted(order.orderId)

    return true
  } catch (error) {
    await failOrderAndRefundMixedWallet(order.id)

    log.error('STARS', 'order fulfillment failed', {
      orderId: order.orderId,
      error: error instanceof Error ? error.message : 'unknown',
    })

    throw new StarsPurchaseError('خطا در ثبت خرید استارز', 'FULFILLMENT_FAILED')
  }
}
