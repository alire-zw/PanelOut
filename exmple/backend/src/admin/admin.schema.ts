import { z } from 'zod'

export const orderStatusSchema = z.enum([
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
])

export const paymentStatusSchema = z.enum(['pending', 'paid', 'failed', 'verified'])

export const cryptoPaymentStatusSchema = z.enum(['pending', 'completed', 'expired', 'swept'])

const paginationSchema = {
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(128).optional(),
}

export const listAdminOrdersQuerySchema = z.object({
  ...paginationSchema,
  status: orderStatusSchema.optional(),
  categorySlug: z.string().trim().max(64).optional(),
})

export const listAdminPaymentsQuerySchema = z.object({
  ...paginationSchema,
  status: paymentStatusSchema.optional(),
})

export const listAdminCryptoPaymentsQuerySchema = z.object({
  ...paginationSchema,
  status: cryptoPaymentStatusSchema.optional(),
})

export const listAdminTransfersQuerySchema = z.object({
  ...paginationSchema,
})

export type ListAdminOrdersQuery = z.infer<typeof listAdminOrdersQuerySchema>
export type ListAdminPaymentsQuery = z.infer<typeof listAdminPaymentsQuerySchema>
export type ListAdminCryptoPaymentsQuery = z.infer<typeof listAdminCryptoPaymentsQuerySchema>
export type ListAdminTransfersQuery = z.infer<typeof listAdminTransfersQuerySchema>
