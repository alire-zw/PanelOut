import { randomBytes } from 'node:crypto'
import type { DbUser } from '../db/types.js'
import { prisma } from '../db/client.js'
import { zibalCallbackUrl } from '../config/env.js'
import { log } from '../lib/logger.js'
import {
  MIN_PAYMENT_RIAL,
  MIN_PAYMENT_TOMAN,
  TOMAN_TO_RIAL,
  ZIBAL_SUCCESS_CODE,
} from './zibal.constants.js'
import {
  buildZibalPaymentUrl,
  createZibalPaymentRequest,
  inquireZibalPayment,
  verifyZibalPayment,
  ZibalApiError,
} from './zibal.client.js'
import type { CreatePaymentInput, ListPaymentsQuery } from './payment.schema.js'
import { isPrismaNotFoundError } from './payment.serializer.js'
import { notifyPaymentInvoiceCreated } from '../bot/notifications/payment-invoice.js'
import { notifyPaymentSucceeded } from '../bot/notifications/payment-success.js'
import { notifyPaymentFailed } from '../bot/notifications/payment-failed.js'
import { invalidateWalletTransactionsCache } from '../wallet/wallet-transaction.service.js'
import {
  expireAllStalePayments,
  expireGatewayPaymentIfStale,
  expireStaleGatewayPayments,
  getPaymentExpiresAt,
  isGatewayPaymentExpired,
} from './payment-expiration.js'
import { fulfillShopOrder } from '../premium/premium-purchase.fulfillment.js'
import { getOrderByPaymentId, markOrderFailedByPaymentId } from '../orders/order.service.js'

const CHARGE_ORDER_ID_OFFSET = 100_000

function buildChargeOrderId(paymentId: number): string {
  return `C-${CHARGE_ORDER_ID_OFFSET + paymentId}`
}

function createTemporaryOrderId(userId: number): string {
  const suffix = randomBytes(3).toString('hex')
  return `TMP-${userId}-${Date.now()}-${suffix}`
}

function tomanToRial(amountToman: bigint): bigint {
  return amountToman * TOMAN_TO_RIAL
}

function rialToToman(amountRial: bigint): bigint {
  return amountRial / TOMAN_TO_RIAL
}

export async function createPaymentRequest(user: DbUser, input: CreatePaymentInput) {
  await expireStaleGatewayPayments(user.id)

  if (input.amount < MIN_PAYMENT_TOMAN) {
    throw new Error(`Minimum payment amount is ${MIN_PAYMENT_TOMAN.toString()} toman`)
  }

  const amountRial = tomanToRial(input.amount)
  if (amountRial < MIN_PAYMENT_RIAL) {
    throw new Error(`Minimum payment amount is ${MIN_PAYMENT_RIAL.toString()} rial`)
  }

  const payment = await prisma.payment.create({
    data: {
      userId: user.id,
      orderId: createTemporaryOrderId(user.id),
      amount: amountRial,
      description: input.description ?? 'شارژ حساب',
      status: 'pending',
      expiresAt: getPaymentExpiresAt(),
    },
  })

  const orderId = buildChargeOrderId(payment.id)

  const paymentWithOrderId = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      orderId,
      description: input.description ?? `شارژ حساب #${orderId}`,
    },
  })

  try {
    const zibal = await createZibalPaymentRequest({
      amountRial: Number(amountRial),
      callbackUrl: zibalCallbackUrl,
      orderId,
      description: paymentWithOrderId.description ?? undefined,
      mobile: user.phoneNumber ?? undefined,
    })

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        trackId: BigInt(zibal.trackId),
        resultCode: zibal.result,
      },
    })

    log.info('PAYMENT', 'request created', {
      orderId,
      trackId: zibal.trackId,
      userId: user.id,
      amountToman: input.amount.toString(),
    })

    const paymentUrl = buildZibalPaymentUrl(zibal.trackId)

    void notifyPaymentInvoiceCreated({
      paymentId: payment.id,
      telegramId: user.telegramId,
      amountToman: input.amount,
      orderId,
      paymentUrl,
      trackId: zibal.trackId.toString(),
    })

    void invalidateWalletTransactionsCache(user.id)

    return {
      payment: updated,
      paymentUrl,
      trackId: zibal.trackId.toString(),
    }
  } catch (error) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'failed' },
    })
    throw error
  }
}

export async function finalizePaymentByTrackId(trackId: bigint) {
  const payment = await prisma.payment.findFirst({
    where: { trackId },
  })

  if (!payment) {
    throw new Error('Payment not found')
  }

  if (payment.status === 'verified') {
    return { payment, alreadyVerified: true }
  }

  try {
    const verified = await verifyZibalPayment(Number(trackId))

    let newlyVerified = false

    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.payment.findUnique({ where: { id: payment.id } })
      if (!current) {
        throw new Error('Payment not found')
      }

      if (current.status === 'verified') {
        return current
      }

      newlyVerified = true

      const saved = await tx.payment.update({
        where: { id: current.id },
        data: {
          status: 'verified',
          refNumber: verified.refNumber ?? null,
          cardNumber: verified.cardNumber ?? null,
          resultCode: verified.result,
          verifiedAt: new Date(),
        },
      })

      const linkedOrder = await tx.order.findFirst({ where: { paymentId: current.id } })
      if (!linkedOrder) {
        await tx.user.update({
          where: { id: current.userId },
          data: {
            balance: { increment: rialToToman(current.amount) },
          },
        })
      }

      return saved
    })

    if (newlyVerified) {
      const linkedOrder = await getOrderByPaymentId(updated.id)
      if (linkedOrder) {
        await fulfillShopOrder(linkedOrder.orderId)
      }
    }

    log.info('PAYMENT', 'verified', {
      orderId: updated.orderId,
      trackId: trackId.toString(),
      userId: updated.userId,
      refNumber: updated.refNumber ?? undefined,
    })

    if (newlyVerified) {
      void notifyPaymentSucceeded(updated.id)
      void invalidateWalletTransactionsCache(updated.userId)
    }

    return { payment: updated, alreadyVerified: !newlyVerified }
  } catch (error) {
    if (error instanceof ZibalApiError && error.resultCode === 201) {
      const existing = await prisma.payment.findFirst({ where: { trackId } })
      if (existing?.status === 'verified') {
        return { payment: existing, alreadyVerified: true }
      }
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'failed',
        resultCode: error instanceof ZibalApiError ? error.resultCode : null,
      },
    })

    void markOrderFailedByPaymentId(payment.id)
    void notifyPaymentFailed(payment.id)
    void invalidateWalletTransactionsCache(payment.userId)

    throw error
  }
}

export async function verifyPaymentForUser(userId: number, trackId: bigint) {
  const payment = await prisma.payment.findFirst({
    where: { trackId, userId },
  })

  if (!payment) {
    throw new Error('Payment not found')
  }

  return finalizePaymentByTrackId(trackId)
}

export async function handlePaymentCallback(input: {
  trackId: bigint
  success?: number
  status?: number
  orderId?: string
}) {
  const payment = await prisma.payment.findFirst({
    where: {
      trackId: input.trackId,
      ...(input.orderId ? { orderId: input.orderId } : {}),
    },
  })

  if (!payment) {
    throw new Error('Payment not found')
  }

  if (isGatewayPaymentExpired(payment)) {
    const expired = await expireGatewayPaymentIfStale(payment)
    return { payment: expired, verified: false }
  }

  if (input.success !== 1) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'failed', resultCode: input.status ?? null },
    })

    void markOrderFailedByPaymentId(payment.id)
    void notifyPaymentFailed(payment.id)
    void invalidateWalletTransactionsCache(payment.userId)

    return { payment, verified: false }
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: 'paid' },
  })

  const result = await finalizePaymentByTrackId(input.trackId)
  return { payment: result.payment, verified: result.payment.status === 'verified' }
}

export async function inquirePayment(trackId: bigint) {
  const response = await inquireZibalPayment(Number(trackId))
  const payment = await prisma.payment.findFirst({ where: { trackId } })

  return { payment, inquiry: response }
}

export async function getPaymentByOrderId(orderId: string, userId?: number) {
  if (userId) {
    await expireStaleGatewayPayments(userId)
  }

  const payment = await prisma.payment.findFirst({
    where: {
      orderId,
      ...(userId ? { userId } : {}),
    },
  })

  if (!payment) {
    return null
  }

  return expireGatewayPaymentIfStale(payment)
}

export async function listUserPayments(userId: number, query: ListPaymentsQuery) {
  await expireStaleGatewayPayments(userId)

  const skip = (query.page - 1) * query.limit

  const [items, total] = await prisma.$transaction([
    prisma.payment.findMany({
      where: { userId },
      orderBy: { id: 'desc' },
      skip,
      take: query.limit,
    }),
    prisma.payment.count({ where: { userId } }),
  ])

  return {
    items,
    total,
    page: query.page,
    limit: query.limit,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
  }
}

export { ZibalApiError, isPrismaNotFoundError, ZIBAL_SUCCESS_CODE, expireAllStalePayments }
