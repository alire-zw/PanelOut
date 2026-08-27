import { env } from '../config/env.js'
import { prisma } from '../db/client.js'
import { redis } from '../redis/client.js'
import { sendSmsIrVerify, SmsIrApiError } from './smsir.client.js'
import {
  generateOtpCode,
  hashOtpCode,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_TTL_SECONDS,
  safeEqualHash,
  toSmsIrMobile,
  type SendPhoneOtpInput,
  type VerifyPhoneOtpInput,
} from './kyc.schema.js'

export class KycPhoneOtpError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'ALREADY_REGISTERED'
      | 'COOLDOWN'
      | 'NOT_FOUND'
      | 'EXPIRED'
      | 'INVALID'
      | 'TOO_MANY_ATTEMPTS'
      | 'SMS_FAILED',
    public readonly retryAfterSeconds?: number,
  ) {
    super(message)
    this.name = 'KycPhoneOtpError'
  }
}

interface StoredOtp {
  phone: string
  codeHash: string
  attempts: number
  createdAt: number
}

function otpKey(userId: number): string {
  return `kyc:phone-otp:${userId}`
}

function cooldownKey(userId: number): string {
  return `kyc:phone-otp-cooldown:${userId}`
}

async function getCooldownRemaining(userId: number): Promise<number> {
  const ttl = await redis.ttl(cooldownKey(userId))
  return ttl > 0 ? ttl : 0
}

export async function sendPhoneOtp(userId: number, input: SendPhoneOtpInput) {
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { phoneNumber: true, phoneVerifiedAt: true },
  })

  if (currentUser?.phoneVerifiedAt && currentUser.phoneNumber) {
    throw new KycPhoneOtpError(
      'شماره موبایل قبلاً ثبت شده و قابل تغییر نیست',
      'ALREADY_REGISTERED',
    )
  }

  const cooldownRemaining = await getCooldownRemaining(userId)
  if (cooldownRemaining > 0) {
    const raw = await redis.get(otpKey(userId))
    if (raw) {
      try {
        const stored = JSON.parse(raw) as StoredOtp
        if (stored.phone === input.phone) {
          const otpTtl = await redis.ttl(otpKey(userId))
          return {
            phone: input.phone,
            expiresInSeconds: otpTtl > 0 ? otpTtl : OTP_TTL_SECONDS,
            resendAvailableInSeconds: cooldownRemaining,
            alreadySent: true as const,
          }
        }
      } catch {
        // fall through to cooldown error
      }
    }

    throw new KycPhoneOtpError(
      'برای ارسال مجدد کد باید صبر کنید',
      'COOLDOWN',
      cooldownRemaining,
    )
  }

  const code = generateOtpCode()
  const payload: StoredOtp = {
    phone: input.phone,
    codeHash: hashOtpCode(code),
    attempts: 0,
    createdAt: Date.now(),
  }

  try {
    await sendSmsIrVerify({
      mobile: toSmsIrMobile(input.phone),
      templateId: env.SMSIR_VERIFY_TEMPLATE_ID,
      parameters: [{ name: env.SMSIR_VERIFY_PARAM_NAME, value: code }],
    })
  } catch (error) {
    if (error instanceof SmsIrApiError) {
      throw new KycPhoneOtpError(error.message || 'ارسال پیامک ناموفق بود', 'SMS_FAILED')
    }
    throw error
  }

  await redis.set(otpKey(userId), JSON.stringify(payload), 'EX', OTP_TTL_SECONDS)
  await redis.set(cooldownKey(userId), '1', 'EX', OTP_RESEND_COOLDOWN_SECONDS)

  return {
    phone: input.phone,
    expiresInSeconds: OTP_TTL_SECONDS,
    resendAvailableInSeconds: OTP_RESEND_COOLDOWN_SECONDS,
    alreadySent: false as const,
  }
}

export async function verifyPhoneOtp(userId: number, input: VerifyPhoneOtpInput) {
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { phoneNumber: true, phoneVerifiedAt: true },
  })

  if (currentUser?.phoneVerifiedAt && currentUser.phoneNumber) {
    throw new KycPhoneOtpError(
      'شماره موبایل قبلاً ثبت شده و قابل تغییر نیست',
      'ALREADY_REGISTERED',
    )
  }

  const raw = await redis.get(otpKey(userId))
  if (!raw) {
    throw new KycPhoneOtpError('کد منقضی شده یا ارسال نشده است', 'NOT_FOUND')
  }

  let stored: StoredOtp
  try {
    stored = JSON.parse(raw) as StoredOtp
  } catch {
    await redis.del(otpKey(userId))
    throw new KycPhoneOtpError('کد منقضی شده یا ارسال نشده است', 'EXPIRED')
  }

  if (stored.phone !== input.phone) {
    throw new KycPhoneOtpError('شماره موبایل با درخواست کد هم‌خوانی ندارد', 'INVALID')
  }

  if (stored.attempts >= OTP_MAX_ATTEMPTS) {
    await redis.del(otpKey(userId))
    throw new KycPhoneOtpError('تعداد تلاش بیش از حد مجاز است. دوباره کد بگیرید', 'TOO_MANY_ATTEMPTS')
  }

  const isValid = safeEqualHash(stored.codeHash, hashOtpCode(input.code))
  if (!isValid) {
    stored.attempts += 1
    if (stored.attempts >= OTP_MAX_ATTEMPTS) {
      await redis.del(otpKey(userId))
      throw new KycPhoneOtpError(
        'تعداد تلاش بیش از حد مجاز است. دوباره کد بگیرید',
        'TOO_MANY_ATTEMPTS',
      )
    }

    const ttl = await redis.ttl(otpKey(userId))
    await redis.set(
      otpKey(userId),
      JSON.stringify(stored),
      'EX',
      ttl > 0 ? ttl : OTP_TTL_SECONDS,
    )
    throw new KycPhoneOtpError('کد وارد شده نادرست است', 'INVALID')
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      phoneNumber: input.phone,
      phoneVerifiedAt: new Date(),
    },
  })

  await redis.del(otpKey(userId))
  await redis.del(cooldownKey(userId))

  return user
}

export async function getPhoneOtpStatus(userId: number) {
  const resendAvailableInSeconds = await getCooldownRemaining(userId)
  const hasPendingOtp = Boolean(await redis.get(otpKey(userId)))
  return {
    hasPendingOtp,
    resendAvailableInSeconds,
  }
}
