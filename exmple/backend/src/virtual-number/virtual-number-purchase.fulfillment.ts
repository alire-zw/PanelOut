import { log } from '../lib/logger.js'
import { prisma } from '../db/client.js'
import { invalidateWalletTransactionsCache } from '../wallet/wallet-transaction.service.js'
import { updateOrderStatus } from '../orders/order.service.js'
import { failOrderAndRefundMixedWallet } from '../orders/order-wallet-refund.js'
import { isCallinooStockError, purchaseCallinooNumber } from './callinoo.client.js'
import { markVirtualNumberCountryUnavailable } from './virtual-number-countries.service.js'
import { notifyOrderCompleted } from '../bot/notifications/order-report.js'

export class VirtualNumberPurchaseError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'PRICE_CHANGED'
      | 'INSUFFICIENT_BALANCE'
      | 'FULFILLMENT_FAILED'
      | 'ORDER_NOT_FOUND'
      | 'COUNTRY_UNAVAILABLE',
  ) {
    super(message)
    this.name = 'VirtualNumberPurchaseError'
  }
}

export async function fulfillVirtualNumberOrder(orderId: string): Promise<boolean> {
  const order = await prisma.order.findUnique({
    where: { orderId },
    include: { category: true, virtualNumber: true },
  })

  if (!order) {
    return false
  }

  if (order.status === 'completed' && order.virtualNumber) {
    return true
  }

  if (order.category.slug !== 'virtual-number') {
    return false
  }

  const countryId = order.recipientUsername?.trim()
  if (!countryId) {
    throw new VirtualNumberPurchaseError('اطلاعات سفارش ناقص است', 'ORDER_NOT_FOUND')
  }

  await updateOrderStatus(order.id, 'processing')

  try {
    const purchased = await purchaseCallinooNumber({
      countryId,
      noneReport: true,
    })

    const countryLabel =
      purchased.country?.trim() ||
      purchased.countery?.trim() ||
      order.recipientName ||
      countryId

    await prisma.$transaction(async (tx) => {
      await tx.virtualNumber.upsert({
        where: { orderDbId: order.id },
        create: {
          orderDbId: order.id,
          providerOrderId: String(purchased.order_id),
          number: String(purchased.number),
          price: BigInt(Math.round(Number(purchased.price) || 0)),
          country: countryLabel,
          range: String(purchased.range),
          service: purchased.service || 'تلگرام (پنل اختصاصی)',
          quality: purchased.quality || '',
        },
        update: {
          providerOrderId: String(purchased.order_id),
          number: String(purchased.number),
          price: BigInt(Math.round(Number(purchased.price) || 0)),
          country: countryLabel,
          range: String(purchased.range),
          service: purchased.service || 'تلگرام (پنل اختصاصی)',
          quality: purchased.quality || '',
        },
      })

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'completed',
          fulfilledAt: new Date(),
        },
      })
    })

    log.info('VIRTUAL_NUMBER', 'order fulfilled', {
      orderId: order.orderId,
      userId: order.userId,
      countryId,
      providerOrderId: purchased.order_id,
      number: purchased.number,
      method: order.paymentMethod,
    })

    void invalidateWalletTransactionsCache(order.userId)
    void notifyOrderCompleted(order.orderId)

    return true
  } catch (error) {
    await failOrderAndRefundMixedWallet(order.id)

    log.error('VIRTUAL_NUMBER', 'order fulfillment failed', {
      orderId: order.orderId,
      error: error instanceof Error ? error.message : 'unknown',
    })

    const rawMessage = error instanceof Error ? error.message : ''
    if (isCallinooStockError(rawMessage)) {
      void markVirtualNumberCountryUnavailable(countryId, true)
      throw new VirtualNumberPurchaseError(
        'در حال حاضر این کشور ناموجود است. لطفاً کشور دیگری انتخاب کنید.',
        'COUNTRY_UNAVAILABLE',
      )
    }

    throw new VirtualNumberPurchaseError('خطا در خرید شماره مجازی', 'FULFILLMENT_FAILED')
  }
}
