import type { DbPayment } from '../db/types.js'
import { Prisma } from '@prisma/client'

export interface SerializedPayment {
  id: number
  userId: number
  orderId: string
  amount: string
  amountToman: string
  description: string | null
  trackId: string | null
  refNumber: string | null
  status: DbPayment['status']
  cardNumber: string | null
  resultCode: number | null
  verifiedAt: string | null
  expiresAt: string | null
  createdAt: string
  updatedAt: string
}

function toToman(amountRial: bigint): string {
  return (amountRial / 10n).toString()
}

export function serializePayment(payment: DbPayment): SerializedPayment {
  return {
    id: payment.id,
    userId: payment.userId,
    orderId: payment.orderId,
    amount: payment.amount.toString(),
    amountToman: toToman(payment.amount),
    description: payment.description,
    trackId: payment.trackId?.toString() ?? null,
    refNumber: payment.refNumber,
    status: payment.status,
    cardNumber: payment.cardNumber,
    resultCode: payment.resultCode,
    verifiedAt: payment.verifiedAt?.toISOString() ?? null,
    expiresAt: payment.expiresAt?.toISOString() ?? null,
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
  }
}

export function serializePayments(payments: DbPayment[]): SerializedPayment[] {
  return payments.map(serializePayment)
}

export function isPrismaNotFoundError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025'
}
