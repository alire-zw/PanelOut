import { log } from '../lib/logger.js'
import { prisma } from '../db/client.js'
import { invalidateWalletTransactionsCache } from '../wallet/wallet-transaction.service.js'
import { updateOrderStatus } from '../orders/order.service.js'
import { failOrderAndRefundMixedWallet } from '../orders/order-wallet-refund.js'
import type { ReactionOrderItemRecord } from '../orders/order.service.js'
import { addPowerTelOrder, PowerTelApiError } from './powertel.client.js'
import { notifyOrderCompleted } from '../bot/notifications/order-report.js'

export class ReactionPurchaseError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'PRICE_CHANGED'
      | 'INSUFFICIENT_BALANCE'
      | 'FULFILLMENT_FAILED'
      | 'ORDER_NOT_FOUND'
      | 'SERVICE_UNAVAILABLE'
      | 'INVALID_QUANTITY',
  ) {
    super(message)
    this.name = 'ReactionPurchaseError'
  }
}

function parseItems(value: unknown): ReactionOrderItemRecord[] {
  if (!Array.isArray(value)) return []

  const items: ReactionOrderItemRecord[] = []

  for (const item of value) {
    if (typeof item !== 'object' || item === null) continue
    const record = item as Record<string, unknown>
    const serviceId = Number(record.serviceId)
    const quantity = Number(record.quantity)
    const rate = Number(record.rate)
    const toman = Number(record.toman)
    const emoji = typeof record.emoji === 'string' ? record.emoji : ''

    if (
      !Number.isFinite(serviceId) ||
      !Number.isFinite(quantity) ||
      !Number.isFinite(rate) ||
      !emoji
    ) {
      continue
    }

    items.push({
      serviceId,
      emoji,
      quantity,
      rate,
      toman: Number.isFinite(toman) ? toman : 0,
      providerOrderId:
        typeof record.providerOrderId === 'string' ? record.providerOrderId : null,
    })
  }

  return items
}

export async function fulfillReactionOrder(orderId: string): Promise<boolean> {
  const order = await prisma.order.findUnique({
    where: { orderId },
    include: { category: true, reactionOrder: true },
  })

  if (!order) {
    return false
  }

  if (order.status === 'completed' && order.reactionOrder) {
    const items = parseItems(order.reactionOrder.itemsJson)
    if (items.length > 0 && items.every((item) => item.providerOrderId)) {
      return true
    }
  }

  if (order.category.slug !== 'reaction') {
    return false
  }

  const reaction = order.reactionOrder
  if (!reaction?.postLink) {
    throw new ReactionPurchaseError('اطلاعات سفارش ناقص است', 'ORDER_NOT_FOUND')
  }

  const items = parseItems(reaction.itemsJson)
  if (items.length === 0) {
    throw new ReactionPurchaseError('اطلاعات سفارش ناقص است', 'ORDER_NOT_FOUND')
  }

  await updateOrderStatus(order.id, 'processing')

  try {
    const fulfilledItems: ReactionOrderItemRecord[] = []

    for (const item of items) {
      if (item.providerOrderId) {
        fulfilledItems.push(item)
        continue
      }

      const providerOrderId = await addPowerTelOrder({
        service: item.serviceId,
        link: reaction.postLink,
        quantity: item.quantity,
      })

      fulfilledItems.push({
        ...item,
        providerOrderId,
      })
    }

    await prisma.$transaction(async (tx) => {
      await tx.reactionOrder.update({
        where: { orderDbId: order.id },
        data: { itemsJson: fulfilledItems },
      })

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'completed',
          fulfilledAt: new Date(),
        },
      })
    })

    log.info('REACTION', 'order fulfilled', {
      orderId: order.orderId,
      userId: order.userId,
      items: fulfilledItems.length,
      method: order.paymentMethod,
    })

    void invalidateWalletTransactionsCache(order.userId)
    void notifyOrderCompleted(order.orderId)

    return true
  } catch (error) {
    await failOrderAndRefundMixedWallet(order.id)

    log.error('REACTION', 'order fulfillment failed', {
      orderId: order.orderId,
      postLink: reaction.postLink,
      error: error instanceof Error ? error.message : 'unknown',
      details:
        error instanceof PowerTelApiError
          ? JSON.stringify(error.details ?? null)
          : undefined,
    })

    throw new ReactionPurchaseError('خطا در ثبت سفارش ری‌اکشن', 'FULFILLMENT_FAILED')
  }
}
