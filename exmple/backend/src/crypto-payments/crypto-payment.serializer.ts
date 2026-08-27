import type { DbCryptoPayment } from '../db/types.js'

export interface SerializedCryptoPayment {
  id: number
  userId: number
  orderId: string
  shopOrderId: string | null
  walletAddress: string
  amountToman: string
  amountTrx: string
  amountTrxSun: string
  trxIrtRate: string
  status: DbCryptoPayment['status']
  incomingTxHash: string | null
  sweepTxHash: string | null
  receivedTrxSun: string | null
  expiresAt: string
  verifiedAt: string | null
  sweptAt: string | null
  createdAt: string
  updatedAt: string
}

export function serializeCryptoPayment(
  payment: DbCryptoPayment,
  walletAddress: string,
  shopOrderId: string | null = null,
): SerializedCryptoPayment {
  return {
    id: payment.id,
    userId: payment.userId,
    orderId: payment.orderId,
    shopOrderId,
    walletAddress,
    amountToman: payment.amountToman.toString(),
    amountTrx: payment.amountTrx,
    amountTrxSun: payment.amountTrxSun.toString(),
    trxIrtRate: payment.trxIrtRate,
    status: payment.status,
    incomingTxHash: payment.incomingTxHash,
    sweepTxHash: payment.sweepTxHash,
    receivedTrxSun: payment.receivedTrxSun?.toString() ?? null,
    expiresAt: payment.expiresAt.toISOString(),
    verifiedAt: payment.verifiedAt?.toISOString() ?? null,
    sweptAt: payment.sweptAt?.toISOString() ?? null,
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
  }
}
