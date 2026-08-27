import { log } from '../lib/logger.js'
import { prisma } from '../db/client.js'
import { invalidateWalletTransactionsCache } from '../wallet/wallet-transaction.service.js'
import { updateOrderStatus } from '../orders/order.service.js'
import { failOrderAndRefundMixedWallet } from '../orders/order-wallet-refund.js'
import { addPowerTelOrder, PowerTelApiError } from '../reaction/powertel.client.js'
import { CHANNEL_VIEW_SERVICE_ID } from './channel-views.pricing.js'
import { notifyOrderCompleted } from '../bot/notifications/order-report.js'

export class ChannelViewsPurchaseError extends Error {
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
    this.name = 'ChannelViewsPurchaseError'
  }
}

export async function fulfillChannelViewsOrder(orderId: string): Promise<boolean> {
  const order = await prisma.order.findUnique({
    where: { orderId },
    include: { category: true, channelViewOrder: true },
  })

  if (!order) {
    return false
  }

  if (order.status === 'completed' && order.channelViewOrder?.providerOrderId) {
    return true
  }

  if (order.category.slug !== 'channel-views') {
    return false
  }

  const channelView = order.channelViewOrder
  if (!channelView?.postLink) {
    throw new ChannelViewsPurchaseError('اطلاعات سفارش ناقص است', 'ORDER_NOT_FOUND')
  }

  if (channelView.serviceId !== CHANNEL_VIEW_SERVICE_ID) {
    throw new ChannelViewsPurchaseError('سرویس بازدید نامعتبر است', 'INVALID_SERVICE')
  }

  if (channelView.providerOrderId) {
    await updateOrderStatus(order.id, 'completed', { fulfilledAt: new Date() })
    void notifyOrderCompleted(order.orderId)
    return true
  }

  await updateOrderStatus(order.id, 'processing')

  try {
    const providerOrderId = await addPowerTelOrder({
      service: channelView.serviceId,
      link: channelView.postLink,
      quantity: channelView.quantity,
    })

    await prisma.$transaction(async (tx) => {
      await tx.channelViewOrder.update({
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

    log.info('CHANNEL_VIEWS', 'order fulfilled', {
      orderId: order.orderId,
      userId: order.userId,
      quantity: channelView.quantity,
      providerOrderId,
      method: order.paymentMethod,
    })

    void invalidateWalletTransactionsCache(order.userId)
    void notifyOrderCompleted(order.orderId)

    return true
  } catch (error) {
    await failOrderAndRefundMixedWallet(order.id)

    log.error('CHANNEL_VIEWS', 'order fulfillment failed', {
      orderId: order.orderId,
      postLink: channelView.postLink,
      error: error instanceof Error ? error.message : 'unknown',
      details:
        error instanceof PowerTelApiError
          ? JSON.stringify(error.details ?? null)
          : undefined,
    })

    throw new ChannelViewsPurchaseError('خطا در ثبت سفارش سین کانال', 'FULFILLMENT_FAILED')
  }
}
