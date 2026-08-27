import { randomBytes } from 'node:crypto'
import { prisma } from '../db/client.js'
import { env } from '../config/env.js'
import { log } from '../lib/logger.js'
import {
  calculateTrxAmountFromToman,
  getTrxIrtPrice,
  SwapWalletApiError,
} from './swapwallet.client.js'
import type { CreateCryptoPaymentInput, ListCryptoPaymentsQuery } from './crypto-payment.schema.js'
import type { DbUser } from '../db/types.js'
import {
  ensureUserTronWallet,
  getWalletBalanceSun,
  sweepWalletBalance,
} from '../tron/wallet.service.js'
import { notifyCryptoPaymentSucceeded } from '../bot/notifications/crypto-payment-success.js'
import { invalidateWalletTransactionsCache } from '../wallet/wallet-transaction.service.js'
import { fulfillShopOrder } from '../premium/premium-purchase.fulfillment.js'
import { getOrderByCryptoPaymentId, markOrderFailedByCryptoPaymentId } from '../orders/order.service.js'
import {
  expireCryptoPaymentIfStale,
  expireStaleCryptoPayments,
  getPaymentExpiresAt,
} from '../payments/payment-expiration.js'

const CHARGE_ORDER_ID_OFFSET = 100_000

const MIN_CRYPTO_PAYMENT_TOMAN = 10_000n
const PAYMENT_MATCH_TOLERANCE_NUM = 99n
const PAYMENT_MATCH_TOLERANCE_DEN = 100n

function createTemporaryOrderId(userId: number): string {
  const suffix = randomBytes(3).toString('hex')
  return `TMP-C-${userId}-${Date.now()}-${suffix}`
}

function buildChargeOrderId(paymentId: number): string {
  return `C-${CHARGE_ORDER_ID_OFFSET + paymentId}`
}

export async function createCryptoPayment(user: DbUser, input: CreateCryptoPaymentInput) {
  await expireStaleCryptoPayments(user.id)
  if (input.amount < MIN_CRYPTO_PAYMENT_TOMAN) {
    throw new Error(`Minimum crypto payment amount is ${MIN_CRYPTO_PAYMENT_TOMAN.toString()} toman`)
  }

  const wallet = await ensureUserTronWallet(user.id)

  const activePending = await prisma.cryptoPayment.findFirst({
    where: {
      userId: user.id,
      status: 'pending',
      expiresAt: { gt: new Date() },
    },
  })

  if (activePending) {
    throw new Error('You already have an active crypto payment. Please wait or let it expire.')
  }

  const trxIrtPrice = await getTrxIrtPrice()
  const { amountTrx, amountTrxSun } = calculateTrxAmountFromToman(input.amount, trxIrtPrice)

  const payment = await prisma.cryptoPayment.create({
    data: {
      userId: user.id,
      walletId: wallet.id,
      orderId: createTemporaryOrderId(user.id),
      amountToman: input.amount,
      amountTrxSun,
      amountTrx,
      trxIrtRate: trxIrtPrice.toString(),
      expiresAt: getPaymentExpiresAt(),
      status: 'pending',
    },
  })

  const orderId = buildChargeOrderId(payment.id)

  const updatedPayment = await prisma.cryptoPayment.update({
    where: { id: payment.id },
    data: { orderId },
  })

  log.info('CRYPTO', 'payment created', {
    orderId,
    userId: user.id,
    amountToman: input.amount.toString(),
    amountTrx,
    address: wallet.address,
  })

  void invalidateWalletTransactionsCache(user.id)

  return { payment: updatedPayment, wallet }
}

export async function getCryptoPaymentByOrderId(orderId: string, userId?: number) {
  if (userId) {
    await expireStaleCryptoPayments(userId)
  }

  const payment = await prisma.cryptoPayment.findFirst({
    where: {
      orderId,
      ...(userId ? { userId } : {}),
    },
    include: { wallet: true },
  })

  if (!payment) {
    return null
  }

  const updated = await expireCryptoPaymentIfStale(payment)
  return { ...updated, wallet: payment.wallet }
}

export async function listUserCryptoPayments(userId: number, query: ListCryptoPaymentsQuery) {
  await expireStaleCryptoPayments(userId)

  const skip = (query.page - 1) * query.limit

  const [items, total] = await prisma.$transaction([
    prisma.cryptoPayment.findMany({
      where: { userId },
      include: { wallet: true },
      orderBy: { id: 'desc' },
      skip,
      take: query.limit,
    }),
    prisma.cryptoPayment.count({ where: { userId } }),
  ])

  return {
    items,
    total,
    page: query.page,
    limit: query.limit,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
  }
}

export async function getCurrentTrxPrice() {
  const price = await getTrxIrtPrice()
  return {
    pair: 'TRX/IRT',
    price,
    network: env.TRON_NETWORK,
  }
}

export async function expireStaleCryptoPaymentsForJob(): Promise<number> {
  return expireStaleCryptoPayments()
}

function isBalanceMatchingPayment(balanceSun: bigint, expectedSun: bigint): boolean {
  const minimum = (expectedSun * PAYMENT_MATCH_TOLERANCE_NUM) / PAYMENT_MATCH_TOLERANCE_DEN
  return balanceSun >= minimum
}

async function completeCryptoPayment(
  paymentId: number,
  receivedSun: bigint,
): Promise<boolean> {
  let newlyCompleted = false
  let completedUserId: number | null = null
  let completedOrderId: string | null = null

  await prisma.$transaction(async (tx) => {
    const payment = await tx.cryptoPayment.findUnique({ where: { id: paymentId } })
    if (!payment || payment.status !== 'pending') {
      return
    }

    newlyCompleted = true
    completedUserId = payment.userId
    completedOrderId = payment.orderId

    await tx.cryptoPayment.update({
      where: { id: payment.id },
      data: {
        status: 'completed',
        receivedTrxSun: receivedSun,
        verifiedAt: new Date(),
      },
    })

    const linkedOrder = await tx.order.findFirst({ where: { cryptoPaymentId: payment.id } })
    if (!linkedOrder) {
      await tx.user.update({
        where: { id: payment.userId },
        data: {
          balance: { increment: payment.amountToman },
        },
      })
    }
  })

  if (newlyCompleted) {
    log.info('CRYPTO', 'payment completed', { paymentId, receivedSun: receivedSun.toString() })

    const linkedOrder = await getOrderByCryptoPaymentId(paymentId)
    if (linkedOrder) {
      await fulfillShopOrder(linkedOrder.orderId)
    } else {
      void notifyCryptoPaymentSucceeded(paymentId)
    }

    if (completedUserId) {
      void invalidateWalletTransactionsCache(completedUserId)
    }
  }

  return newlyCompleted
}

export async function processWalletBalances(): Promise<void> {
  await expireStaleCryptoPayments()

  const wallets = await prisma.tronWallet.findMany({
    include: {
      user: true,
      payments: {
        where: { status: 'pending', expiresAt: { gt: new Date() } },
        orderBy: { id: 'desc' },
        take: 1,
      },
    },
  })

  for (const wallet of wallets) {
    try {
      const balanceSun = await getWalletBalanceSun(wallet.address)
      if (balanceSun <= 0n) {
        continue
      }

      const pendingPayment = wallet.payments[0]
      let completedPaymentId: number | null = null

      if (pendingPayment && isBalanceMatchingPayment(balanceSun, pendingPayment.amountTrxSun)) {
        await completeCryptoPayment(pendingPayment.id, balanceSun)
        completedPaymentId = pendingPayment.id
      }

      const sweep = await sweepWalletBalance(wallet.address, wallet.privateKey)
      if (!sweep) {
        continue
      }

      if (completedPaymentId) {
        await prisma.cryptoPayment.update({
          where: { id: completedPaymentId },
          data: {
            sweepTxHash: sweep.txId,
            sweptAt: new Date(),
            status: 'swept',
          },
        })
      }

      log.info('CRYPTO', 'wallet processed', {
        address: wallet.address,
        userId: wallet.userId,
        sweptSun: sweep.amountSun.toString(),
      })
    } catch (error) {
      log.error('CRYPTO', 'wallet processing failed', {
        address: wallet.address,
        userId: wallet.userId,
        error: error instanceof Error ? error.message : 'unknown',
      })
    }
  }
}

export { SwapWalletApiError }
