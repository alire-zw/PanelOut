import { z } from 'zod'
import { prisma } from '../db/client.js'

export const addBankCardBodySchema = z.object({
  cardNumber: z
    .string()
    .trim()
    .regex(/^\d{16}$/, 'شماره کارت باید ۱۶ رقم باشد'),
  bankName: z.string().trim().min(1).max(128).optional(),
  bankSlug: z.string().trim().min(1).max(64).optional(),
  bankBin: z
    .string()
    .trim()
    .regex(/^\d{6,8}$/)
    .optional(),
})

export type AddBankCardBody = z.infer<typeof addBankCardBodySchema>

export class BankCardError extends Error {
  constructor(
    message: string,
    readonly code: 'DUPLICATE' | 'NOT_FOUND' | 'INVALID',
  ) {
    super(message)
    this.name = 'BankCardError'
  }
}

export function serializeBankCard(card: {
  id: number
  cardNumber: string
  bankName: string | null
  bankSlug: string | null
  bankBin: string | null
  isPrimary: boolean
  isVerified: boolean
  matchedAt: Date | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: card.id,
    cardNumber: card.cardNumber,
    bankName: card.bankName,
    bankSlug: card.bankSlug,
    bankBin: card.bankBin,
    isPrimary: card.isPrimary,
    isVerified: card.isVerified,
    matchedAt: card.matchedAt?.toISOString() ?? null,
    createdAt: card.createdAt.toISOString(),
    updatedAt: card.updatedAt.toISOString(),
  }
}

export async function listBankCardsForUser(userId: number) {
  const cards = await prisma.bankCard.findMany({
    where: { userId },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
  })

  return cards.map(serializeBankCard)
}

export async function addBankCardForUser(userId: number, input: AddBankCardBody) {
  const existing = await prisma.bankCard.findUnique({
    where: {
      userId_cardNumber: {
        userId,
        cardNumber: input.cardNumber,
      },
    },
  })

  if (existing) {
    throw new BankCardError('این کارت قبلاً ثبت شده است', 'DUPLICATE')
  }

  const hasPrimary = await prisma.bankCard.findFirst({
    where: { userId, isPrimary: true },
    select: { id: true },
  })

  const card = await prisma.bankCard.create({
    data: {
      userId,
      cardNumber: input.cardNumber,
      bankName: input.bankName ?? null,
      bankSlug: input.bankSlug ?? null,
      bankBin: input.bankBin ?? input.cardNumber.slice(0, 6),
      isPrimary: !hasPrimary,
    },
  })

  return serializeBankCard(card)
}
