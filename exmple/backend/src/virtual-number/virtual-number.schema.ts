import { z } from 'zod'

export const virtualNumberCountriesQuerySchema = z.object({
  none_report: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((value) => value !== 'false'),
})

export const virtualNumberPurchaseBodySchema = z.object({
  countryId: z.string().trim().min(1).max(32),
  country: z.string().trim().min(1).max(128),
  flagCode: z.string().trim().min(2).max(8),
  quality: z.enum(['economy', 'standard', 'premium']),
  toman: z.number().int().positive(),
  noneReport: z.boolean().optional().default(true),
  useWalletBalance: z.boolean().optional(),
})

export type VirtualNumberPurchaseBody = z.infer<typeof virtualNumberPurchaseBodySchema>
