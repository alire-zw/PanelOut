import { prisma } from '../db/client.js'
import { KycIdentityError } from './identity.service.js'
import type { SaveKycCardInput } from './kyc.schema.js'

export async function saveKycBankCard(userId: number, input: SaveKycCardInput) {
  const current = await prisma.user.findUnique({ where: { id: userId } })
  if (!current) {
    throw new KycIdentityError('کاربر یافت نشد', 'PHONE_REQUIRED')
  }

  if (!current.phoneVerifiedAt || !current.phoneNumber) {
    throw new KycIdentityError('ابتدا شماره موبایل را تأیید کنید', 'PHONE_REQUIRED')
  }

  if (!current.nationalId || !current.birthDate) {
    throw new KycIdentityError('ابتدا اطلاعات هویتی را تکمیل کنید', 'PHONE_REQUIRED')
  }

  if (current.kycVerifiedAt) {
    throw new KycIdentityError('احراز هویت قبلاً تکمیل شده است', 'ALREADY_COMPLETED')
  }

  await prisma.bankCard.updateMany({
    where: { userId, isPrimary: true, cardNumber: { not: input.cardNumber } },
    data: { isPrimary: false },
  })

  const card = await prisma.bankCard.upsert({
    where: {
      userId_cardNumber: {
        userId,
        cardNumber: input.cardNumber,
      },
    },
    create: {
      userId,
      cardNumber: input.cardNumber,
      bankName: input.bankName ?? null,
      bankSlug: input.bankSlug ?? null,
      bankBin: input.bankBin ?? input.cardNumber.slice(0, 6),
      isPrimary: true,
    },
    update: {
      bankName: input.bankName ?? undefined,
      bankSlug: input.bankSlug ?? undefined,
      bankBin: input.bankBin ?? input.cardNumber.slice(0, 6),
      isPrimary: true,
    },
  })

  return card
}

export async function getPrimaryBankCard(userId: number) {
  return prisma.bankCard.findFirst({
    where: { userId },
    orderBy: [{ isPrimary: 'desc' }, { updatedAt: 'desc' }],
  })
}
