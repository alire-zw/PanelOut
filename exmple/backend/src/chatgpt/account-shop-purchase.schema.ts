import { z } from 'zod'
import { isAccountShopCategoryId } from './account-shop.catalog.js'

export const accountShopPurchaseBodySchema = z.object({
  planId: z.number().int().positive(),
  categoryId: z
    .string()
    .trim()
    .refine((value) => isAccountShopCategoryId(value), 'Invalid account category'),
  toman: z.number().int().positive(),
  fieldValues: z.record(z.string(), z.string().trim().max(500)).default({}),
  useWalletBalance: z.boolean().optional(),
})

export type AccountShopPurchaseBody = z.infer<typeof accountShopPurchaseBodySchema>
