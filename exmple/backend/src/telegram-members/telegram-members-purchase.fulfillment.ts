import { log } from '../lib/logger.js'
import { prisma } from '../db/client.js'
import { invalidateWalletTransactionsCache } from '../wallet/wallet-transaction.service.js'
import { updateOrderStatus } from '../orders/order.service.js'
import { failOrderAndRefundMixedWallet } from '../orders/order-wallet-refund.js'
import { addPowerTelOrder, PowerTelApiError } from '../reaction/powertel.client.js'
import { isTelegramMemberServiceId } from './telegram-members.pricing.js'
import { notifyOrderCompleted } from '../bot/notifications/order-report.js'

export class TelegramMembersPurchaseError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'PRICE_CHANGED'
      | 'INSUFFICIENT_BALANCE'
      | 'FULFILLMENT_FAILED'
      | 'ORDER_NOT_FOUND'
      | 'SERVICE_UNAVAILABLE'
      | 'INVALID_QUANTITY'
      | 'INVALID_SERVICE',
  ) {
    super(message)
    this.name = 'TelegramMembersPurchaseError'
  }
}

export async function fulfillTelegramMembersOrder(orderId: string): Promise<boolean> {
  const order = await prisma.order.findUnique({
    where: { orderId },
    include: { category: true, telegramMemberOrder: true },
  })

  if (!order) {
    return false
  }

  if (order.status === 'completed' && order.telegramMemberOrder?.providerOrderId) {
    return true
  }

  if (order.category.slug !== 'telegram-members') {
    return false
  }

  const memberOrder = order.telegramMemberOrder
  if (!memberOrder?.channelLink) {
    throw new TelegramMembersPurchaseError('اطلاعات سفارش ناقص است', 'ORDER_NOT_FOUND')
  }

  if (!isTelegramMemberServiceId(memberOrder.serviceId)) {
    throw new TelegramMembersPurchaseError('سرویس ممبر نامعتبر است', 'INVALID_SERVICE')
  }

  if (memberOrder.providerOrderId) {
    await updateOrderStatus(order.id, 'completed', { fulfilledAt: new Date() })
    void notifyOrderCompleted(order.orderId)
    return true
  }

  await updateOrderStatus(order.id, 'processing')

  try {
    const providerOrderId = await addPowerTelOrder({
      service: memberOrder.serviceId,
      link: memberOrder.channelLink,
      quantity: memberOrder.quantity,
    })

    await prisma.$transaction(async (tx) => {
      await tx.telegramMemberOrder.update({
        where: { orderDbId: order.id },
        data: { providerOrderId },
      })

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'completed',
          fulfilledAt: new Date(),
        },
      })
    })

    log.info('TELEGRAM_MEMBERS', 'order fulfilled', {
      orderId: order.orderId,
      userId: order.userId,
      quantity: memberOrder.quantity,
      serviceId: memberOrder.serviceId,
      providerOrderId,
      method: order.paymentMethod,
    })

    void invalidateWalletTransactionsCache(order.userId)
    void notifyOrderCompleted(order.orderId)

    return true
  } catch (error) {
    await failOrderAndRefundMixedWallet(order.id)

    log.error('TELEGRAM_MEMBERS', 'order fulfillment failed', {
      orderId: order.orderId,
      channelLink: memberOrder.channelLink,
      error: error instanceof Error ? error.message : 'unknown',
      details:
        error instanceof PowerTelApiError
          ? JSON.stringify(error.details ?? null)
          : undefined,
    })

    throw new TelegramMembersPurchaseError('خطا در ثبت سفارش ممبر تلگرام', 'FULFILLMENT_FAILED')
  }
}
