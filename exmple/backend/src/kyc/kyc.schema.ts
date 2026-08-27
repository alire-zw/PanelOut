import { createHash, randomInt, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { isValidIranNationalId, jalaliBirthToUtcDate } from './identity.js'

export const IR_MOBILE_REGEX = /^09\d{9}$/
export const OTP_LENGTH = 5
export const OTP_TTL_SECONDS = 5 * 60
export const OTP_RESEND_COOLDOWN_SECONDS = 2 * 60
export const OTP_MAX_ATTEMPTS = 5

export const sendPhoneOtpSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(IR_MOBILE_REGEX, 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود'),
})

export const verifyPhoneOtpSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(IR_MOBILE_REGEX, 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود'),
  code: z
    .string()
    .trim()
    .regex(new RegExp(`^\\d{${OTP_LENGTH}}$`), `کد باید ${OTP_LENGTH} رقم باشد`),
})

export const completeKycIdentitySchema = z
  .object({
    nationalId: z
      .string()
      .trim()
      .regex(/^\d{10}$/, 'کد ملی باید ۱۰ رقم باشد')
      .refine(isValidIranNationalId, 'کد ملی معتبر نیست'),
    birthDate: z
      .string()
      .trim()
      .regex(/^\d{4}\/\d{2}\/\d{2}$/, 'تاریخ تولد را به صورت ۱۳۸۰/۱۱/۰۴ وارد کنید'),
  })
  .superRefine((value, ctx) => {
    if (!jalaliBirthToUtcDate(value.birthDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['birthDate'],
        message: 'تاریخ تولد معتبر نیست',
      })
    }
  })

export const saveKycCardSchema = z.object({
  cardNumber: z
    .string()
    .trim()
    .regex(/^\d{16}$/, 'شماره کارت باید ۱۶ رقم باشد'),
  bankName: z.string().trim().max(128).optional(),
  bankSlug: z.string().trim().max(64).optional(),
  bankBin: z
    .string()
    .trim()
    .regex(/^\d{6}$/)
    .optional(),
})

export const verifyKycCardMatchSchema = z.object({
  cardNumber: z
    .string()
    .trim()
    .regex(/^\d{16}$/, 'شماره کارت باید ۱۶ رقم باشد')
    .optional(),
})

export type SendPhoneOtpInput = z.infer<typeof sendPhoneOtpSchema>
export type VerifyPhoneOtpInput = z.infer<typeof verifyPhoneOtpSchema>
export type CompleteKycIdentityInput = z.infer<typeof completeKycIdentitySchema>
export type SaveKycCardInput = z.infer<typeof saveKycCardSchema>
export type VerifyKycCardMatchInput = z.infer<typeof verifyKycCardMatchSchema>

export function normalizeIranMobile(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('98') && digits.length === 12) {
    return `0${digits.slice(2)}`
  }
  if (digits.length === 10 && digits.startsWith('9')) {
    return `0${digits}`
  }
  return digits
}

/** SMS.ir sample uses 10-digit mobile without leading zero. */
export function toSmsIrMobile(phone: string): string {
  const normalized = normalizeIranMobile(phone)
  return normalized.startsWith('0') ? normalized.slice(1) : normalized
}

export function generateOtpCode(length = OTP_LENGTH): string {
  const max = 10 ** length
  return String(randomInt(0, max)).padStart(length, '0')
}

export function hashOtpCode(code: string): string {
  return createHash('sha256').update(code).digest('hex')
}

export function safeEqualHash(left: string, right: string): boolean {
  const leftBuf = Buffer.from(left)
  const rightBuf = Buffer.from(right)
  if (leftBuf.length !== rightBuf.length) return false
  return timingSafeEqual(leftBuf, rightBuf)
}
