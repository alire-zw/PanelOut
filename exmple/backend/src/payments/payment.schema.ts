import { z } from 'zod'

export const createPaymentSchema = z.object({
  amount: z.coerce.bigint().positive(),
  description: z.string().trim().max(255).optional(),
})

export const verifyPaymentSchema = z.object({
  trackId: z.coerce.bigint().positive(),
})

export const inquiryPaymentSchema = z.object({
  trackId: z.coerce.bigint().positive(),
})

export const listPaymentsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export const callbackQuerySchema = z.object({
  trackId: z.coerce.bigint().positive(),
  success: z.coerce.number().optional(),
  status: z.coerce.number().optional(),
  orderId: z.string().optional(),
})

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>
export type InquiryPaymentInput = z.infer<typeof inquiryPaymentSchema>
export type ListPaymentsQuery = z.infer<typeof listPaymentsQuerySchema>
export type CallbackQuery = z.infer<typeof callbackQuerySchema>
