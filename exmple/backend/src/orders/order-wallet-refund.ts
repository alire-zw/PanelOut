import { prisma } from '../db/client.js'
import { invalidateWalletTransactionsCache } from '../wallet/wallet-transaction.service.js'
import { invalidateUserOrdersCache } from './user-orders.cache.js'

/** Mark order failed and refund mixed-gateway wallet portion (not pure wallet pays). */
export async function failOrderAndRefundMixedWallet(orderDbId: number): Promise<void> {
  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.order.findUnique({ where: { id: orderDbId } })
    if (!current || current.status === 'completed' || current.status === 'failed') {
      return null
    }

    if (current.walletAmountToman > 0n && current.paymentMethod !== 'wallet') {
      await tx.user.update({
        where: { id: current.userId },
        data: { balance: { increment: current.walletAmountToman } },
      })
    }

    return tx.order.update({
      where: { id: current.id },
      data: { status: 'failed', failedAt: new Date() },
    })
  })

  if (updated) {
    void invalidateWalletTransactionsCache(updated.userId)
    void invalidateUserOrdersCache(updated.userId)
  }
}
