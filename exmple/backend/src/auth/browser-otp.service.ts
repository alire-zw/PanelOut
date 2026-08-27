import { createHash } from 'node:crypto'
import { env } from '../config/env.js'
import { prisma } from '../db/client.js'
import type { DbUser } from '../db/types.js'
import { redis } from '../redis/client.js'
import { sendSmsIrVerify, SmsIrApiError } from '../kyc/smsir.client.js'
import {
  generateOtpCode,
  hashOtpCode,
  normalizeIranMobile,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_TTL_SECONDS,
  safeEqualHash,
  toSmsIrMobile,
} from '../kyc/kyc.schema.js'
import { ensureUserTronWallet } from '../tron/wallet.service.js'
import { createBrowserSessionToken } from './browser-session.js'

export class BrowserAuthError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'DISABLED'
      | 'COOLDOWN'
      | 'RATE_LIMIT'
      | 'NOT_FOUND'
      | 'EXPIRED'
      | 'INVALID'
      | 'TOO_MANY_ATTEMPTS'
      | 'SMS_FAILED',
    public readonly retryAfterSeconds?: number,
  ) {
    super(message)
    this.name = 'BrowserAuthError'
  }
}

interface StoredOtp {
  phone: string
  codeHash: string
  attempts: number
  createdAt: number
}

function assertBrowserModeEnabled() {
  if (!env.BROWSER_PUBLIC_MODE) {
    throw new BrowserAuthError('ورود مرورگر فعلاً غیرفعال است', 'DISABLED')
  }
}

function otpKey(phone: string): string {
  return `browser:otp:${phone}`
}

function cooldownKey(phone: string): string {
  return `browser:otp-cooldown:${phone}`
}

function phoneHourKey(phone: string): string {
  return `browser:otp-hour:phone:${phone}`
}

function ipHourKey(ip: string): string {
  return `browser:otp-hour:ip:${ip}`
}

function syntheticTelegramId(phone: string): bigint {
  const digest = createHash('sha256').update(`ns-browser:${phone}`).digest()
  let value = 0n
  for (let i = 0; i < 7; i += 1) {
    value = (value << 8n) + BigInt(digest[i]!)
  }
  value = value % 8_000_000_000_000_000n
  if (value === 0n) value = 1n
  return -value
}

async function getCooldownRemaining(phone: string): Promise<number> {
  const ttl = await redis.ttl(cooldownKey(phone))
  return ttl > 0 ? ttl : 0
}

async function assertSendRateLimits(phone: string, ip: string | undefined) {
  const phoneCount = Number((await redis.get(phoneHourKey(phone))) || '0')
  if (phoneCount >= 8) {
    const ttl = await redis.ttl(phoneHourKey(phone))
    throw new BrowserAuthError(
      'تعداد پیامک این شماره زیاد شده است. کمی بعد دوباره تلاش کنید',
      'RATE_LIMIT',
      ttl > 0 ? ttl : 3600,
    )
  }

  if (ip) {
    const ipCount = Number((await redis.get(ipHourKey(ip))) || '0')
    if (ipCount >= 20) {
      const ttl = await redis.ttl(ipHourKey(ip))
      throw new BrowserAuthError(
        'تعداد درخواست از این شبکه زیاد است. کمی بعد دوباره تلاش کنید',
        'RATE_LIMIT',
        ttl > 0 ? ttl : 3600,
      )
    }
  }
}

async function bumpSendCounters(phone: string, ip: string | undefined) {
  const phoneExists = await redis.exists(phoneHourKey(phone))
  await redis.incr(phoneHourKey(phone))
  if (!phoneExists) await redis.expire(phoneHourKey(phone), 3600)

  if (ip) {
    const ipExists = await redis.exists(ipHourKey(ip))
    await redis.incr(ipHourKey(ip))
    if (!ipExists) await redis.expire(ipHourKey(ip), 3600)
  }
}

export async function findOrCreateBrowserUser(phone: string): Promise<DbUser> {
  const normalized = normalizeIranMobile(phone)

  const existing = await prisma.user.findFirst({
    where: { phoneNumber: normalized },
    orderBy: { id: 'asc' },
  })

  if (existing) {
    if (!existing.phoneVerifiedAt) {
      return prisma.user.update({
        where: { id: existing.id },
        data: {
          phoneVerifiedAt: new Date(),
          isActive: true,
        },
      })
    }
    return existing
  }

  const user = await prisma.user.create({
    data: {
      telegramId: syntheticTelegramId(normalized),
      phoneNumber: normalized,
      phoneVerifiedAt: new Date(),
      firstName: 'کاربر',
      languageCode: 'fa',
      isActive: true,
    },
  })

  await ensureUserTronWallet(user.id)
  return user
}

export async function sendBrowserLoginOtp(input: {
  phone: string
  ip?: string
}) {
  assertBrowserModeEnabled()

  const phone = normalizeIranMobile(input.phone)
  await assertSendRateLimits(phone, input.ip)

  const cooldownRemaining = await getCooldownRemaining(phone)
  if (cooldownRemaining > 0) {
    const raw = await redis.get(otpKey(phone))
    if (raw) {
      try {
        const stored = JSON.parse(raw) as StoredOtp
        if (stored.phone === phone) {
          const otpTtl = await redis.ttl(otpKey(phone))
          return {
            phone,
            expiresInSeconds: otpTtl > 0 ? otpTtl : OTP_TTL_SECONDS,
            resendAvailableInSeconds: cooldownRemaining,
            alreadySent: true as const,
          }
        }
      } catch {
        // fall through
      }
    }

    throw new BrowserAuthError(
      'برای ارسال مجدد کد باید صبر کنید',
      'COOLDOWN',
      cooldownRemaining,
    )
  }

  const code = generateOtpCode()
  const payload: StoredOtp = {
    phone,
    codeHash: hashOtpCode(code),
    attempts: 0,
    createdAt: Date.now(),
  }

  try {
    await sendSmsIrVerify({
      mobile: toSmsIrMobile(phone),
      templateId: env.SMSIR_VERIFY_TEMPLATE_ID,
      parameters: [{ name: env.SMSIR_VERIFY_PARAM_NAME, value: code }],
    })
  } catch (error) {
    if (error instanceof SmsIrApiError) {
      throw new BrowserAuthError(error.message || 'ارسال پیامک ناموفق بود', 'SMS_FAILED')
    }
    throw error
  }

  await redis.set(otpKey(phone), JSON.stringify(payload), 'EX', OTP_TTL_SECONDS)
  await redis.set(cooldownKey(phone), '1', 'EX', OTP_RESEND_COOLDOWN_SECONDS)
  await bumpSendCounters(phone, input.ip)

  return {
    phone,
    expiresInSeconds: OTP_TTL_SECONDS,
    resendAvailableInSeconds: OTP_RESEND_COOLDOWN_SECONDS,
    alreadySent: false as const,
  }
}

export async function verifyBrowserLoginOtp(input: {
  phone: string
  code: string
}) {
  assertBrowserModeEnabled()

  const phone = normalizeIranMobile(input.phone)
  const raw = await redis.get(otpKey(phone))
  if (!raw) {
    throw new BrowserAuthError('کد منقضی شده یا ارسال نشده است', 'NOT_FOUND')
  }

  let stored: StoredOtp
  try {
    stored = JSON.parse(raw) as StoredOtp
  } catch {
    await redis.del(otpKey(phone))
    throw new BrowserAuthError('کد منقضی شده است', 'EXPIRED')
  }

  if (stored.phone !== phone) {
    throw new BrowserAuthError('کد برای این شماره معتبر نیست', 'INVALID')
  }

  if (stored.attempts >= OTP_MAX_ATTEMPTS) {
    await redis.del(otpKey(phone))
    throw new BrowserAuthError('تعداد تلاش بیش از حد مجاز است', 'TOO_MANY_ATTEMPTS')
  }

  if (!safeEqualHash(stored.codeHash, hashOtpCode(input.code))) {
    stored.attempts += 1
    const ttl = await redis.ttl(otpKey(phone))
    if (stored.attempts >= OTP_MAX_ATTEMPTS) {
      await redis.del(otpKey(phone))
      throw new BrowserAuthError('تعداد تلاش بیش از حد مجاز است', 'TOO_MANY_ATTEMPTS')
    }
    await redis.set(otpKey(phone), JSON.stringify(stored), 'EX', ttl > 0 ? ttl : OTP_TTL_SECONDS)
    throw new BrowserAuthError('کد وارد شده نادرست است', 'INVALID')
  }

  await redis.del(otpKey(phone))
  await redis.del(cooldownKey(phone))

  const user = await findOrCreateBrowserUser(phone)
  if (user.isBanned || !user.isActive) {
    throw new BrowserAuthError('حساب کاربری غیرفعال است', 'INVALID')
  }

  const session = createBrowserSessionToken(user.id)
  return { user, session }
}
