import { z } from 'zod'

export const clubRewardTypeSchema = z.enum([
  'percent_discount',
  'fixed_discount',
  'free_item',
  'custom',
])

export const createClubRewardSchema = z.object({
  title: z.string().trim().min(2).max(128),
  description: z.string().trim().min(2).max(512),
  pointsCost: z.coerce.number().int().positive().max(1_000_000),
  rewardType: clubRewardTypeSchema,
  rewardValue: z.string().trim().min(1).max(255),
  stock: z.coerce.number().int().positive().max(1_000_000).nullable().optional(),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.coerce.number().int().min(0).max(10_000).optional().default(0),
})

export const updateClubRewardSchema = createClubRewardSchema.partial()

export const discountTypeSchema = z.enum(['percent', 'fixed'])

export const createDiscountSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/, 'Invalid discount code'),
  title: z.string().trim().min(2).max(128),
  description: z.string().trim().max(512).optional().nullable(),
  discountType: discountTypeSchema,
  discountValue: z.coerce.number().int().positive().max(100_000_000),
  maxUses: z.coerce.number().int().positive().max(10_000_000).nullable().optional(),
  minOrderToman: z.coerce.number().int().nonnegative().max(10_000_000_000).nullable().optional(),
  productKey: z.string().trim().max(96).nullable().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  isActive: z.boolean().optional().default(true),
})

export const updateDiscountSchema = createDiscountSchema.partial()

export const upsertPricingSchema = z.object({
  productKey: z.string().trim().min(1).max(96),
  label: z.string().trim().min(1).max(128),
  markupPercent: z.coerce.number().int().min(-90).max(500),
  fixedAddToman: z.coerce.number().int().min(0).max(10_000_000_000),
  isActive: z.boolean().optional().default(true),
  note: z.string().trim().max(255).nullable().optional(),
})

export const listTicketsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['open', 'answered', 'closed']).optional(),
  category: z.enum(['sales', 'product', 'kyc', 'wallet', 'other']).optional(),
  search: z.string().trim().max(128).optional(),
})

export const createTicketSchema = z.object({
  userId: z.coerce.number().int().positive(),
  subject: z.string().trim().min(2).max(160).optional(),
  category: z.enum(['sales', 'product', 'kyc', 'wallet', 'other']).default('other'),
  orderId: z.string().trim().min(1).max(64).optional(),
  body: z.string().trim().min(2).max(4000),
})

export const replyTicketSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  status: z.enum(['open', 'answered', 'closed']).optional(),
})

export type CreateClubRewardInput = z.infer<typeof createClubRewardSchema>
export type UpdateClubRewardInput = z.infer<typeof updateClubRewardSchema>
export type CreateDiscountInput = z.infer<typeof createDiscountSchema>
export type UpdateDiscountInput = z.infer<typeof updateDiscountSchema>
export type UpsertPricingInput = z.infer<typeof upsertPricingSchema>
export type ListTicketsQuery = z.infer<typeof listTicketsQuerySchema>
export type CreateTicketInput = z.infer<typeof createTicketSchema>
export type ReplyTicketInput = z.infer<typeof replyTicketSchema>
