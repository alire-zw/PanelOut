import { ACCOUNT_SHOP_PRODUCT_KEYS } from '../chatgpt/account-shop.catalog.js'
import { SHOP_CATEGORIES } from '../orders/shop-category.data.js'
import { z } from 'zod'

export const SHOP_PRODUCT_KEYS: readonly string[] = [
  ...SHOP_CATEGORIES.map((category) => category.slug),
  ...ACCOUNT_SHOP_PRODUCT_KEYS,
]

export const productKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(96)
  .regex(/^[a-z0-9][a-z0-9:_-]*$/i, 'Invalid product key')

export const recordProductViewSchema = z.object({
  productKey: productKeySchema,
})

export type RecordProductViewInput = z.infer<typeof recordProductViewSchema>

export function isKnownShopProductKey(productKey: string): boolean {
  const root = productKey.split(':')[0]?.toLowerCase() ?? ''
  return SHOP_PRODUCT_KEYS.includes(root)
}
