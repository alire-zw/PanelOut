import { createHash } from 'node:crypto'
import { prisma } from '../db/client.js'
import type { DbCryptoPayment, DbPayment } from '../db/types.js'
import type { Prisma } from '@prisma/client'
import type { SerializedWalletTransaction } from './wallet-transaction.types.js'

const LIST_LIMIT = 50

type OrderWithCategory = Prisma.OrderGetPayload<{
  include: { category: true; accountShopOrder: true }
}>

function formatFaDate(value: Date | string): string {
  return new Date(value).toLocaleString('fa-IR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function paymentToTransaction(payment: DbPayment): SerializedWalletTransaction {
  const amountToman = Number(payment.amount / 10n)
  const date = formatFaDate(payment.createdAt)
  const base = {
    orderId: payment.orderId,
    createdAt: payment.createdAt.toISOString(),
    paymentMethod: 'zibal' as const,
    trackId: payment.trackId?.toString() ?? null,
    refNumber: payment.refNumber,
    cardNumber: payment.cardNumber,
    expiresAt: payment.expiresAt?.toISOString() ?? null,
  }

  if (payment.status === 'verified') {
    return {
      id: `zibal-${payment.orderId}`,
      type: 'deposit',
      title: 'شارژ حساب',
      amount: amountToman,
      date,
      status: 'success',
      verifiedAt: payment.verifiedAt?.toISOString() ?? null,
      ...base,
    }
  }

  if (payment.status === 'failed') {
    return {
      id: `zibal-${payment.orderId}`,
      type: 'deposit',
      title: 'شارژ ناموفق',
      amount: amountToman,
      date,
      status: 'failed',
      ...base,
    }
  }

  return {
    id: `zibal-${payment.orderId}`,
    type: 'deposit',
    title: 'شارژ در انتظار',
    amount: amountToman,
    date,
    status: 'pending',
    ...base,
  }
}

function cryptoPaymentToTransaction(payment: DbCryptoPayment): SerializedWalletTransaction {
  const amountToman = Number(payment.amountToman)
  const date = formatFaDate(payment.createdAt)
  const base = {
    orderId: payment.orderId,
    createdAt: payment.createdAt.toISOString(),
    paymentMethod: 'tron' as const,
    amountTrx: payment.amountTrx,
    incomingTxHash: payment.incomingTxHash,
    expiresAt: payment.expiresAt.toISOString(),
  }

  if (payment.status === 'completed' || payment.status === 'swept') {
    return {
      id: `tron-${payment.orderId}`,
      type: 'deposit',
      title: 'شارژ با ترون',
      amount: amountToman,
      date,
      status: 'success',
      verifiedAt: payment.verifiedAt?.toISOString() ?? null,
      ...base,
    }
  }

  if (payment.status === 'expired') {
    return {
      id: `tron-${payment.orderId}`,
      type: 'deposit',
      title: 'شارژ ترون ناموفق',
      amount: amountToman,
      date,
      status: 'failed',
      ...base,
    }
  }

  return {
    id: `tron-${payment.orderId}`,
    type: 'deposit',
    title: 'شارژ ترون در انتظار',
    amount: amountToman,
    date,
    status: 'pending',
    ...base,
  }
}

function buildOrderTitle(order: OrderWithCategory): string {
  const isStars = order.category.slug === 'telegram-stars'
  const isPremium = order.category.slug === 'telegram-premium'
  const isReaction = order.category.slug === 'reaction'
  const isChannelViews = order.category.slug === 'channel-views'
  const isTelegramMembers = order.category.slug === 'telegram-members'
  const isAccountShop = order.category.slug === 'chatgpt'

  if (isPremium) {
    if (order.status === 'failed' || order.status === 'cancelled') {
      return 'خرید ناموفق تلگرام پریمیوم'
    }
    if (order.status === 'pending' || order.status === 'processing') {
      return 'خرید در انتظار · پریمیوم تلگرام'
    }
    return 'خرید موفق تلگرام پریمیوم'
  }

  if (isReaction) {
    if (order.status === 'failed' || order.status === 'cancelled') {
      return 'خرید ناموفق ری‌اکشن'
    }
    if (order.status === 'pending' || order.status === 'processing') {
      return 'خرید در انتظار · ری‌اکشن'
    }
    return 'خرید موفق ری‌اکشن'
  }

  if (isChannelViews) {
    if (order.status === 'failed' || order.status === 'cancelled') {
      return 'خرید ناموفق سین کانال'
    }
    if (order.status === 'pending' || order.status === 'processing') {
      return 'خرید در انتظار · سین کانال'
    }
    return 'خرید موفق سین کانال'
  }

  if (isTelegramMembers) {
    if (order.status === 'failed' || order.status === 'cancelled') {
      return 'خرید ناموفق ممبر تلگرام'
    }
    if (order.status === 'pending' || order.status === 'processing') {
      return 'خرید در انتظار · ممبر تلگرام'
    }
    return 'خرید موفق ممبر تلگرام'
  }

  if (isAccountShop) {
    if (order.status === 'failed' || order.status === 'cancelled') {
      return 'خرید ناموفق اکانت'
    }
    if (order.status === 'pending') {
      return 'سفارش در انتظار پرداخت'
    }
    if (order.accountShopOrder?.status === 'processing') {
      return 'در حال پردازش · اکانت'
    }
    return 'خرید موفق اکانت'
  }

  if (!isStars) {
    if (order.status === 'failed' || order.status === 'cancelled') {
      return `${order.category.label} (ناموفق)`
    }
    if (order.status === 'pending' || order.status === 'processing') {
      return `${order.category.label} (در انتظار)`
    }
    return order.category.label
  }

  if (order.status === 'failed' || order.status === 'cancelled') {
    return 'خرید ناموفق استارز تلگرام'
  }

  if (order.status === 'pending' || order.status === 'processing') {
    return 'خرید در انتظار · استارز تلگرام'
  }

  return 'خرید موفق استارز تلگرام'
}

function orderToTransaction(order: OrderWithCategory): SerializedWalletTransaction {
  const amountToman = Number(order.amountToman)
  const walletAmountToman = Number(order.walletAmountToman)
  const gatewayAmountToman = amountToman - walletAmountToman
  const date = formatFaDate(order.createdAt)
  const paymentMethod: SerializedWalletTransaction['paymentMethod'] =
    order.paymentMethod === 'zibal'
      ? 'zibal'
      : order.paymentMethod === 'tron'
        ? 'tron'
        : 'wallet'

  const base = {
    orderId: order.orderId,
    createdAt: order.createdAt.toISOString(),
    paymentMethod,
    recipientUsername: order.recipientUsername,
    recipientName: order.recipientName,
    quantity: order.quantity,
    categorySlug: order.category.slug,
    walletAmountToman,
    gatewayAmountToman,
  }

  const isAccountShop = order.category.slug === 'chatgpt'
  const accountFulfillment = order.accountShopOrder?.status
  // Paid + registered/delivered → success; admin "processing" → pending badge
  const isAccountShopPaidSuccess =
    isAccountShop &&
    (order.status === 'processing' || order.status === 'completed') &&
    accountFulfillment !== 'processing'

  const status =
    order.status === 'completed' || isAccountShopPaidSuccess
      ? 'success'
      : order.status === 'failed' || order.status === 'cancelled'
        ? 'failed'
        : 'pending'

  return {
    id: `order-${order.orderId}`,
    type: 'purchase',
    title: buildOrderTitle(order),
    amount: -amountToman,
    date,
    status,
    verifiedAt: order.fulfilledAt?.toISOString() ?? null,
    ...base,
  }
}

export async function buildTransactionFingerprint(userId: number): Promise<string> {
  const [payments, crypto, orders, accountShop, sent, received] = await Promise.all([
    prisma.payment.aggregate({
      where: { userId },
      _max: { id: true, updatedAt: true },
      _count: true,
    }),
    prisma.cryptoPayment.aggregate({
      where: { userId },
      _max: { id: true, updatedAt: true },
      _count: true,
    }),
    prisma.order.aggregate({
      where: { userId },
      _max: { id: true, updatedAt: true },
      _count: true,
    }),
    prisma.accountShopOrder.aggregate({
      where: { order: { userId } },
      _max: { id: true, updatedAt: true },
      _count: true,
    }),
    prisma.transfer.aggregate({
      where: { senderId: userId },
      _max: { id: true, createdAt: true },
      _count: true,
    }),
    prisma.transfer.aggregate({
      where: { recipientId: userId },
      _max: { id: true, createdAt: true },
      _count: true,
    }),
  ])

  return JSON.stringify({ payments, crypto, orders, accountShop, sent, received })
}

export async function buildTransactionVersion(userId: number): Promise<string> {
  const fingerprint = await buildTransactionFingerprint(userId)
  return createHash('sha256').update(fingerprint).digest('hex').slice(0, 16)
}

export async function buildWalletTransactions(userId: number): Promise<SerializedWalletTransaction[]> {
  const [payments, cryptoPayments, orders, sentTransfers, receivedTransfers] = await Promise.all([
    prisma.payment.findMany({
      where: { userId },
      orderBy: { id: 'desc' },
      take: LIST_LIMIT,
    }),
    prisma.cryptoPayment.findMany({
      where: { userId },
      orderBy: { id: 'desc' },
      take: LIST_LIMIT,
    }),
    prisma.order.findMany({
      where: { userId },
      orderBy: { id: 'desc' },
      take: LIST_LIMIT,
      include: { category: true, accountShopOrder: true },
    }),
    prisma.transfer.findMany({
      where: { senderId: userId },
      orderBy: { id: 'desc' },
      take: LIST_LIMIT,
      include: {
        recipient: {
          select: { telegramId: true },
        },
      },
    }),
    prisma.transfer.findMany({
      where: { recipientId: userId },
      orderBy: { id: 'desc' },
      take: LIST_LIMIT,
      include: {
        sender: {
          select: { telegramId: true },
        },
      },
    }),
  ])

  const linkedPaymentIds = new Set(
    orders.map((order) => order.paymentId).filter((id): id is number => id != null),
  )
  const linkedCryptoPaymentIds = new Set(
    orders.map((order) => order.cryptoPaymentId).filter((id): id is number => id != null),
  )

  const transferItems: SerializedWalletTransaction[] = [
    ...sentTransfers.map((transfer) => ({
      id: `transfer-out-${transfer.transferId}`,
      type: 'transfer' as const,
      title: 'انتقال موجودی',
      amount: -Number(transfer.amount),
      date: formatFaDate(transfer.createdAt),
      status: 'success' as const,
      orderId: transfer.transferId,
      createdAt: transfer.createdAt.toISOString(),
      transferDirection: 'out' as const,
      counterpartyTelegramId: Number(transfer.recipient.telegramId),
    })),
    ...receivedTransfers.map((transfer) => ({
      id: `transfer-in-${transfer.transferId}`,
      type: 'transfer' as const,
      title: 'دریافت موجودی',
      amount: Number(transfer.amount),
      date: formatFaDate(transfer.createdAt),
      status: 'success' as const,
      orderId: transfer.transferId,
      createdAt: transfer.createdAt.toISOString(),
      transferDirection: 'in' as const,
      counterpartyTelegramId: Number(transfer.sender.telegramId),
    })),
  ]

  return [
    ...payments.filter((payment) => !linkedPaymentIds.has(payment.id)).map(paymentToTransaction),
    ...cryptoPayments
      .filter((payment) => !linkedCryptoPaymentIds.has(payment.id))
      .map(cryptoPaymentToTransaction),
    ...orders.map(orderToTransaction),
    ...transferItems,
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, LIST_LIMIT)
}
