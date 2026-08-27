import { log } from '../lib/logger.js'
import { prisma } from '../db/client.js'
import { invalidateWalletTransactionsCache } from '../wallet/wallet-transaction.service.js'
import { invalidateUserOrdersCache } from '../orders/user-orders.cache.js'
import { updateOrderStatus } from '../orders/order.service.js'
import { notifyOrderCompleted } from '../bot/notifications/order-report.js'
import { notifyAccountShopStatusChanged } from '../bot/notifications/account-shop-status.js'
import {
  sendAccountShopOrderDeliveredSms,
  sendAccountShopOrderReceivedSms,
} from './account-shop-order-sms.service.js'

export class AccountShopPurchaseError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'PRICE_CHANGED'
      | 'INSUFFICIENT_BALANCE'
      | 'PLAN_NOT_FOUND'
      | 'PLAN_UNAVAILABLE'
      | 'INVALID_FIELDS'
      | 'OUT_OF_STOCK'
      | 'ORDER_NOT_FOUND'
      | 'INVALID_STATUS'
      | 'FULFILLMENT_FAILED',
  ) {
    super(message)
    this.name = 'AccountShopPurchaseError'
  }
}

type AccountFulfillmentStatus = 'registered' | 'processing' | 'delivered'

function invalidateCaches(userId: number): void {
  void invalidateWalletTransactionsCache(userId)
  void invalidateUserOrdersCache(userId)
}

/** After payment: mark order processing + fulfillment registered, SMS received. */
export async function fulfillAccountShopOrder(orderId: string): Promise<boolean> {
  const order = await prisma.order.findUnique({
    where: { orderId },
    include: { category: true, accountShopOrder: true },
  })

  if (!order) return false
  if (order.category.slug !== 'chatgpt') return false

  if (order.status === 'completed' || order.status === 'processing') {
    if (order.status === 'processing' && order.accountShopOrder) {
      return true
    }
    if (order.status === 'completed') return true
  }

  if (!order.accountShopOrder) {
    throw new AccountShopPurchaseError('اطلاعات سفارش اکانت ناقص است', 'ORDER_NOT_FOUND')
  }

  await prisma.$transaction(async (tx) => {
    await tx.accountShopOrder.update({
      where: { orderDbId: order.id },
      data: { status: 'registered' },
    })
    await tx.order.update({
      where: { id: order.id },
      data: { status: 'processing' },
    })
  })

  log.info('ACCOUNT_SHOP', 'order registered after payment', {
    orderId: order.orderId,
    userId: order.userId,
    planId: order.accountShopOrder.planId,
    method: order.paymentMethod,
  })

  invalidateCaches(order.userId)
  void notifyOrderCompleted(order.orderId)
  void sendAccountShopOrderReceivedSms(order.userId, order.orderId)

  return true
}

/** Admin can freely move fulfillment between registered / processing / delivered. */
export async function setAccountShopOrderFulfillmentStatus(
  orderId: string,
  status: AccountFulfillmentStatus,
  deliveryNote?: string,
): Promise<boolean> {
  const order = await prisma.order.findUnique({
    where: { orderId },
    include: { category: true, accountShopOrder: true },
  })
  if (!order?.accountShopOrder || order.category.slug !== 'chatgpt') return false

  const current = order.accountShopOrder.status
  const note = deliveryNote?.trim() ?? ''

  if (status === 'delivered') {
    if (!note) {
      throw new AccountShopPurchaseError('متن تحویل سفارش الزامی است', 'INVALID_FIELDS')
    }

    const now = new Date()
    const wasDelivered = current === 'delivered'
    await prisma.$transaction(async (tx) => {
      await tx.accountShopOrder.update({
        where: { orderDbId: order.id },
        data: {
          status: 'delivered',
          deliveryNote: note,
          deliveredAt: wasDelivered ? order.accountShopOrder!.deliveredAt ?? now : now,
        },
      })
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'completed',
          fulfilledAt: wasDelivered ? order.fulfilledAt ?? now : now,
        },
      })
    })

    invalidateCaches(order.userId)
    if (!wasDelivered) {
      void sendAccountShopOrderDeliveredSms(order.userId, order.orderId)
      void notifyAccountShopStatusChanged({
        userId: order.userId,
        orderId: order.orderId,
        status: 'delivered',
        planName: order.accountShopOrder.planName,
      })
    }

    log.info('ACCOUNT_SHOP', wasDelivered ? 'delivery note updated' : 'order delivered', {
      orderId: order.orderId,
      userId: order.userId,
    })
    return true
  }

  // registered | processing — reopen / rewind fulfillment
  const statusChanged = current !== status
  await prisma.$transaction(async (tx) => {
    await tx.accountShopOrder.update({
      where: { orderDbId: order.id },
      data: {
        status,
        deliveredAt: null,
        ...(note ? { deliveryNote: note } : {}),
      },
    })
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'processing',
        fulfilledAt: null,
      },
    })
  })

  if (order.status === 'pending') {
    await updateOrderStatus(order.id, 'processing')
  } else {
    invalidateCaches(order.userId)
  }

  if (statusChanged) {
    void notifyAccountShopStatusChanged({
      userId: order.userId,
      orderId: order.orderId,
      status,
      planName: order.accountShopOrder.planName,
    })
  }

  log.info('ACCOUNT_SHOP', 'fulfillment status set', {
    orderId: order.orderId,
    userId: order.userId,
    from: current,
    to: status,
  })

  return true
}

/** @deprecated Prefer setAccountShopOrderFulfillmentStatus */
export async function markAccountShopOrderProcessing(orderId: string): Promise<boolean> {
  return setAccountShopOrderFulfillmentStatus(orderId, 'processing')
}

/** @deprecated Prefer setAccountShopOrderFulfillmentStatus */
export async function markAccountShopOrderDelivered(
  orderId: string,
  deliveryNote: string,
): Promise<boolean> {
  return setAccountShopOrderFulfillmentStatus(orderId, 'delivered', deliveryNote)
}
