import { prisma } from '../db/client.js'
import { env } from '../config/env.js'
import { log } from '../lib/logger.js'
import { notifyCryptoPaymentFailed } from '../bot/notifications/crypto-payment-failed.js'
import { notifyPaymentFailed } from '../bot/notifications/payment-failed.js'
import {
  markOrderFailedByCryptoPaymentId,
  markOrderFailedByPaymentId,
} from '../orders/order.service.js'
import type { DbCryptoPayment, DbPayment } from '../db/types.js'

export const PAYMENT_TTL_MS = env.CRYPTO_PAYMENT_TTL_MINUTES * 60_000

export function getPaymentExpiresAt(): Date {
  return new Date(Date.now() + PAYMENT_TTL_MS)
}

export function getGatewayPaymentExpiry(payment: {
  expiresAt: Date | null
  createdAt: Date
}): Date {
  return payment.expiresAt ?? new Date(payment.createdAt.getTime() + PAYMENT_TTL_MS)
}

export function isGatewayPaymentExpired(payment: {
  expiresAt: Date | null
  createdAt: Date
  status: DbPayment['status']
}): boolean {
  if (payment.status !== 'pending' && payment.status !== 'paid') {
    return false
  }

  return getGatewayPaymentExpiry(payment).getTime() <= Date.now()
}

export function isCryptoPaymentExpired(payment: {
  expiresAt: Date
  status: DbCryptoPayment['status']
}): boolean {
  return payment.status === 'pending' && payment.expiresAt.getTime() <= Date.now()
}

export async function expireStaleGatewayPayments(userId?: number): Promise<number> {
  const now = new Date()
  const cutoff = new Date(Date.now() - PAYMENT_TTL_MS)

  const stale = await prisma.payment.findMany({
    where: {
      ...(userId ? { userId } : {}),
      status: { in: ['pending', 'paid'] },
      OR: [{ expiresAt: { lt: now } }, { expiresAt: null, createdAt: { lt: cutoff } }],
    },
  })

  for (const payment of stale) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'failed' },
    })

    void markOrderFailedByPaymentId(payment.id)
    void notifyPaymentFailed(payment.id)
  }

  if (stale.length > 0) {
    log.info('PAYMENT', 'expired stale gateway payments', {
      count: stale.length,
      userId,
    })
  }

  return stale.length
}

export async function expireStaleCryptoPayments(userId?: number): Promise<number> {
  const stale = await prisma.cryptoPayment.findMany({
    where: {
      ...(userId ? { userId } : {}),
      status: 'pending',
      expiresAt: { lt: new Date() },
    },
  })

  for (const payment of stale) {
    await prisma.cryptoPayment.update({
      where: { id: payment.id },
      data: { status: 'expired' },
    })

    void markOrderFailedByCryptoPaymentId(payment.id)
    void notifyCryptoPaymentFailed(payment.id)
  }

  if (stale.length > 0) {
    log.info('CRYPTO', 'expired stale crypto payments', {
      count: stale.length,
      userId,
    })
  }

  return stale.length
}

export async function expireAllStalePayments(userId?: number): Promise<void> {
  await Promise.all([expireStaleGatewayPayments(userId), expireStaleCryptoPayments(userId)])
}

export async function expireGatewayPaymentIfStale(payment: DbPayment): Promise<DbPayment> {
  if (!isGatewayPaymentExpired(payment)) {
    return payment
  }

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: { status: 'failed' },
  })

  void markOrderFailedByPaymentId(updated.id)
  void notifyPaymentFailed(updated.id)

  return updated
}

export async function expireCryptoPaymentIfStale(
  payment: DbCryptoPayment,
): Promise<DbCryptoPayment> {
  if (!isCryptoPaymentExpired(payment)) {
    return payment
  }

  const updated = await prisma.cryptoPayment.update({
    where: { id: payment.id },
    data: { status: 'expired' },
  })

  void markOrderFailedByCryptoPaymentId(updated.id)
  void notifyCryptoPaymentFailed(updated.id)

  return updated
}
