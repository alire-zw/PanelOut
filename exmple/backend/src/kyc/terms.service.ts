import { prisma } from '../db/client.js'
import { KycIdentityError } from './identity.service.js'
import { getPrimaryBankCard } from './card.service.js'

export async function acceptKycTerms(userId: number) {
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

  const card = await getPrimaryBankCard(userId)
  if (!card) {
    throw new KycIdentityError('ابتدا شماره کارت را ثبت کنید', 'PHONE_REQUIRED')
  }

  if (current.termsAcceptedAt) {
    return current
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      termsAcceptedAt: new Date(),
    },
  })
}
