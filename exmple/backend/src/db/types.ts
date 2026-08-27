import type { Prisma } from '@prisma/client'

export type DbUser = Prisma.UserGetPayload<Record<string, never>>
export type DbUserRole = DbUser['role']
export type DbPayment = Prisma.PaymentGetPayload<Record<string, never>>
export type DbTronWallet = Prisma.TronWalletGetPayload<Record<string, never>>
export type DbCryptoPayment = Prisma.CryptoPaymentGetPayload<Record<string, never>>
