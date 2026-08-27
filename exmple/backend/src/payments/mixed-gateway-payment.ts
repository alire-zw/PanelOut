import type { DbUser } from '../db/types.js'
import { prisma } from '../db/client.js'
import { linkOrderPayment } from '../orders/order.service.js'
import { invalidateWalletTransactionsCache } from '../wallet/wallet-transaction.service.js'
import { createPaymentRequest } from './payment.service.js'
import { resolveWalletGatewaySplit } from './wallet-gateway-split.js'

export { resolveWalletGatewaySplit } from './wallet-gateway-split.js'

type CreatedOrder = { id: number; orderId: string }

export type MixedGatewayPaymentResult = {
  orderId: string
  paymentUrl: string
  trackId: string | number | bigint
  toman: number
  walletAmountToman: number
  gatewayAmountToman: number
}

export async function createShopGatewayPaymentWithWallet<TFullWallet>(options: {
  user: DbUser
  toman: number
  useWalletBalance?: boolean
  description: string
  createOrder: (walletAmountToman: number) => Promise<CreatedOrder>
  purchaseFullyWithWallet: () => Promise<TFullWallet>
  throwInsufficientBalance: () => never
}): Promise<TFullWallet | MixedGatewayPaymentResult> {
  const { walletAmount, gatewayAmount } = resolveWalletGatewaySplit(
    options.toman,
    options.user.balance,
    Boolean(options.useWalletBalance),
  )

  if (gatewayAmount === 0n) {
    return options.purchaseFullyWithWallet()
  }

  if (walletAmount > 0n && options.user.balance < walletAmount) {
    options.throwInsufficientBalance()
  }

  const order = await options.createOrder(Number(walletAmount))

  if (walletAmount > 0n) {
    try {
      await prisma.$transaction(async (tx) => {
        const current = await tx.user.findUnique({ where: { id: options.user.id } })
        if (!current || current.balance < walletAmount) {
          options.throwInsufficientBalance()
        }

        await tx.user.update({
          where: { id: options.user.id },
          data: { balance: { decrement: walletAmount } },
        })
      })
    } catch (error) {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'failed', failedAt: new Date() },
      })
      throw error
    }
  }

  try {
    const result = await createPaymentRequest(options.user, {
      amount: gatewayAmount,
      description: options.description,
    })

    await linkOrderPayment(order.id, result.payment.id)
    void invalidateWalletTransactionsCache(options.user.id)

    return {
      orderId: order.orderId,
      paymentUrl: result.paymentUrl,
      trackId: result.trackId,
      toman: options.toman,
      walletAmountToman: Number(walletAmount),
      gatewayAmountToman: Number(gatewayAmount),
    }
  } catch (error) {
    if (walletAmount > 0n) {
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: options.user.id },
          data: { balance: { increment: walletAmount } },
        })
        await tx.order.update({
          where: { id: order.id },
          data: { status: 'failed', failedAt: new Date() },
        })
      })
    } else {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'failed', failedAt: new Date() },
      })
    }

    throw error
  }
}
