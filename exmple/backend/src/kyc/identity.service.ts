import { prisma } from '../db/client.js'
import { jalaliBirthToUtcDate } from './identity.js'
import type { CompleteKycIdentityInput } from './kyc.schema.js'

export class KycIdentityError extends Error {
  constructor(
    message: string,
    public readonly code: 'PHONE_REQUIRED' | 'INVALID_BIRTH' | 'ALREADY_COMPLETED',
  ) {
    super(message)
    this.name = 'KycIdentityError'
  }
}

export async function completeKycIdentity(userId: number, input: CompleteKycIdentityInput) {
  const current = await prisma.user.findUnique({ where: { id: userId } })
  if (!current) {
    throw new KycIdentityError('کاربر یافت نشد', 'PHONE_REQUIRED')
  }

  if (!current.phoneVerifiedAt || !current.phoneNumber) {
    throw new KycIdentityError('ابتدا شماره موبایل را تأیید کنید', 'PHONE_REQUIRED')
  }

  if (current.kycVerifiedAt) {
    throw new KycIdentityError('احراز هویت قبلاً تکمیل شده است', 'ALREADY_COMPLETED')
  }

  const birthDate = jalaliBirthToUtcDate(input.birthDate)
  if (!birthDate) {
    throw new KycIdentityError('تاریخ تولد معتبر نیست', 'INVALID_BIRTH')
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      nationalId: input.nationalId,
      birthDate,
    },
  })
}
