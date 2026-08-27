import { z } from 'zod'

export const createCryptoPaymentSchema = z.object({
  amount: z.coerce.bigint().positive(),
})

export const listCryptoPaymentsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export type CreateCryptoPaymentInput = z.infer<typeof createCryptoPaymentSchema>
export type ListCryptoPaymentsQuery = z.infer<typeof listCryptoPaymentsQuerySchema>
