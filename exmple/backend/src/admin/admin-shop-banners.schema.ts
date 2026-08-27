import { z } from 'zod'
import { ACCOUNT_SHOP_PRODUCT_KEYS } from '../chatgpt/account-shop.catalog.js'
import { SHOP_CATEGORIES } from '../orders/shop-category.data.js'

export const SHOP_BANNER_PRODUCT_KEYS = [
  ...SHOP_CATEGORIES.map((item) => item.slug),
  ...ACCOUNT_SHOP_PRODUCT_KEYS,
] as [string, ...string[]]

const dataUrlImageSchema = z
  .string()
  .trim()
  .regex(/^data:image\/(jpeg|jpg|png|webp);base64,/i, 'تصویر باید jpg، png یا webp باشد')
  .max(12_000_000)

export const createShopBannerSchema = z.object({
  title: z.string().trim().min(1).max(128),
  productKey: z.enum(SHOP_BANNER_PRODUCT_KEYS),
  mainImage: dataUrlImageSchema,
  thumbImage: dataUrlImageSchema,
  sortOrder: z.number().int().min(0).max(999).optional(),
  isActive: z.boolean().optional(),
})

export type CreateShopBannerInput = z.infer<typeof createShopBannerSchema>

export const updateShopBannerSchema = z.object({
  title: z.string().trim().min(1).max(128).optional(),
  productKey: z.enum(SHOP_BANNER_PRODUCT_KEYS).optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
  isActive: z.boolean().optional(),
})

export type UpdateShopBannerInput = z.infer<typeof updateShopBannerSchema>
