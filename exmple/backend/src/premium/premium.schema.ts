import { z } from 'zod'

export const premiumMonthsSchema = z.union([z.literal(3), z.literal(6), z.literal(12)])

export const premiumRecipientBodySchema = z.object({
  username: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .transform((value) => value.replace(/^@+/, '')),
  months: premiumMonthsSchema,
})

export const premiumPriceBodySchema = z.object({
  months: premiumMonthsSchema,
})

export const premiumPurchaseBodySchema = z.object({
  username: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .transform((value) => value.replace(/^@+/, '')),
  months: premiumMonthsSchema,
  toman: z.coerce.number().int().positive(),
  recipientName: z.string().trim().max(128).optional(),
  recipientPhoto: z.string().trim().max(2048).optional(),
  useWalletBalance: z.boolean().optional(),
})

export type PremiumPurchaseBody = z.infer<typeof premiumPurchaseBodySchema>
