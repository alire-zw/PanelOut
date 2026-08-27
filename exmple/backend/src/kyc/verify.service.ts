import { prisma } from '../db/client.js'
import { gregorianUtcToJalaliBirth } from './jalali.js'
import { normalizeIranMobile } from './kyc.schema.js'
import { getPrimaryBankCard } from './card.service.js'
import {
  zibalCheckCardWithNationalCode,
  zibalShahkarInquiry,
  ZibalFacilityError,
} from './zibal-facility.client.js'

export class KycVerifyError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'PHONE_REQUIRED'
      | 'IDENTITY_REQUIRED'
      | 'CARD_REQUIRED'
      | 'TERMS_REQUIRED'
      | 'MISMATCH'
      | 'FACILITY_ERROR'
      | 'ALREADY_COMPLETED',
  ) {
    super(message)
    this.name = 'KycVerifyError'
  }
}

async function requireKycReadyUser(userId: number) {
  const current = await prisma.user.findUnique({ where: { id: userId } })
  if (!current) {
    throw new KycVerifyError('کاربر یافت نشد', 'PHONE_REQUIRED')
  }
  if (!current.phoneVerifiedAt || !current.phoneNumber) {
    throw new KycVerifyError('ابتدا شماره موبایل را تأیید کنید', 'PHONE_REQUIRED')
  }
  if (!current.nationalId || !current.birthDate) {
    throw new KycVerifyError('ابتدا اطلاعات هویتی را تکمیل کنید', 'IDENTITY_REQUIRED')
  }
  return current
}

async function maybeCompleteKyc(userId: number) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user || user.kycVerifiedAt) return user

  if (!user.shahkarMatchedAt || !user.termsAcceptedAt) return user

  const verifiedCard = await prisma.bankCard.findFirst({
    where: { userId, isVerified: true },
  })
  if (!verifiedCard) return user

  return prisma.user.update({
    where: { id: userId },
    data: { kycVerifiedAt: new Date() },
  })
}

export async function verifyShahkarMatch(userId: number) {
  const current = await requireKycReadyUser(userId)

  if (current.shahkarMatchedAt) {
    const user = await maybeCompleteKyc(userId)
    return {
      matched: true as const,
      cached: true as const,
      user: user ?? current,
    }
  }

  const mobile = normalizeIranMobile(current.phoneNumber!)
  try {
    const result = await zibalShahkarInquiry({
      mobile,
      nationalCode: current.nationalId!,
    })

    if (!result.matched) {
      throw new KycVerifyError(
        'شماره موبایل با کد ملی مطابقت ندارد',
        'MISMATCH',
      )
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { shahkarMatchedAt: new Date() },
    })

    const user = (await maybeCompleteKyc(userId)) ?? updated
    return { matched: true as const, cached: false as const, user }
  } catch (error) {
    if (error instanceof KycVerifyError) throw error
    if (error instanceof ZibalFacilityError) {
      throw new KycVerifyError(error.message, 'FACILITY_ERROR')
    }
    throw error
  }
}

export async function verifyCardNationalMatch(userId: number, cardNumber?: string) {
  const current = await requireKycReadyUser(userId)

  if (!current.termsAcceptedAt) {
    throw new KycVerifyError('ابتدا قوانین را بپذیرید', 'TERMS_REQUIRED')
  }

  let card =
    (cardNumber
      ? await prisma.bankCard.findUnique({
          where: { userId_cardNumber: { userId, cardNumber } },
        })
      : null) ?? (await getPrimaryBankCard(userId))

  if (!card && cardNumber) {
    card = await prisma.bankCard.create({
      data: {
        userId,
        cardNumber,
        bankBin: cardNumber.slice(0, 6),
        isPrimary: true,
      },
    })
  }

  if (!card) {
    throw new KycVerifyError('شماره کارت یافت نشد', 'CARD_REQUIRED')
  }

  if (card.isVerified && card.matchedAt) {
    const user = (await maybeCompleteKyc(userId)) ?? current
    return {
      matched: true as const,
      cached: true as const,
      user,
      cardId: card.id,
    }
  }

  try {
    const birthDate = gregorianUtcToJalaliBirth(current.birthDate!)
    const result = await zibalCheckCardWithNationalCode({
      nationalCode: current.nationalId!,
      birthDate,
      cardNumber: card.cardNumber,
    })

    if (!result.matched) {
      throw new KycVerifyError('شماره کارت با کد ملی مطابقت ندارد', 'MISMATCH')
    }

    await prisma.bankCard.update({
      where: { id: card.id },
      data: {
        isVerified: true,
        matchedAt: new Date(),
        isPrimary: true,
      },
    })

    const user = (await maybeCompleteKyc(userId)) ?? current
    return {
      matched: true as const,
      cached: false as const,
      user,
      cardId: card.id,
    }
  } catch (error) {
    if (error instanceof KycVerifyError) throw error
    if (error instanceof ZibalFacilityError) {
      throw new KycVerifyError(error.message, 'FACILITY_ERROR')
    }
    throw error
  }
}
