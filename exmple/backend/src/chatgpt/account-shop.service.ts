import {
  convertUsdtToToman,
  getUsdtIrtPrice,
} from '../crypto-payments/swapwallet.client.js'
import {
  applyProductPricing,
  getProductPricingRule,
} from '../pricing/product-pricing.apply.js'
import {
  ACCOUNT_SHOP_CATALOG,
  ACCOUNT_SHOP_CATEGORIES,
  ACCOUNT_SHOP_PRODUCT_IDS,
  accountShopProductKey,
  type AccountShopCategoryId,
} from './account-shop.catalog.js'
import { CanbosoApiError, fetchCanbosoProducts, type CanbosoProduct } from './canboso.client.js'

async function applyAccountShopPricing(
  categoryId: AccountShopCategoryId,
  baseToman: number,
): Promise<number> {
  const productKey = accountShopProductKey(categoryId)
  const specificRule = await getProductPricingRule(productKey)
  if (specificRule) {
    return applyProductPricing(productKey, baseToman)
  }
  return applyProductPricing('chatgpt', baseToman)
}

function resolveUsdPrice(product: CanbosoProduct): number {
  const candidates = [product.usdPricing, product.walletPricing, product.pricing]
  for (const value of candidates) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return value
    }
  }
  return 0
}

function resolveAvailable(product: CanbosoProduct): number | null {
  const available = product.stats?.available
  if (typeof available === 'number' && Number.isFinite(available)) {
    return Math.max(0, Math.floor(available))
  }
  return null
}

export type AccountShopProduct = {
  productId: string
  categoryId: AccountShopCategoryId
  categoryLabel: string
  name: string
  shortDesc: string
  priceUsd: number
  toman: number
  available: number | null
  inStock: boolean
  isSlot: boolean
  requiresCustomerEmail: boolean
  requiresSlotMonths: boolean
  slotDurations: number[]
  sortOrder: number
}

export type AccountShopCatalogResponse = {
  usdtIrtPrice: number
  categories: Array<{ id: AccountShopCategoryId; label: string }>
  products: AccountShopProduct[]
}

export async function getAccountShopCatalog(): Promise<AccountShopCatalogResponse> {
  const [remoteProducts, usdtIrtPrice] = await Promise.all([
    fetchCanbosoProducts(),
    getUsdtIrtPrice(),
  ])

  const byId = new Map(remoteProducts.map((item) => [item._id, item]))
  const categoryLabel = new Map(
    ACCOUNT_SHOP_CATEGORIES.map((item) => [item.id, item.labelFa] as const),
  )

  const products: AccountShopProduct[] = []

  for (const catalogItem of ACCOUNT_SHOP_CATALOG) {
    if (!ACCOUNT_SHOP_PRODUCT_IDS.has(catalogItem.productId)) continue
    const remote = byId.get(catalogItem.productId)
    if (!remote) continue

    const priceUsd = resolveUsdPrice(remote)
    if (priceUsd <= 0) continue

    const available = resolveAvailable(remote)
    const baseToman = convertUsdtToToman(priceUsd, usdtIrtPrice)
    const toman = await applyAccountShopPricing(catalogItem.categoryId, baseToman)

    products.push({
      productId: catalogItem.productId,
      categoryId: catalogItem.categoryId,
      categoryLabel: categoryLabel.get(catalogItem.categoryId) ?? catalogItem.categoryId,
      name: catalogItem.nameFa,
      shortDesc: catalogItem.shortDescFa,
      priceUsd,
      toman,
      available,
      inStock: available == null ? true : available > 0,
      isSlot: Boolean(remote.isSlotProduct) || remote.slotProductType === 'slot',
      requiresCustomerEmail: Boolean(remote.requiresCustomerEmail),
      requiresSlotMonths: Boolean(remote.requiresSlotMonths),
      slotDurations: Array.isArray(remote.slotDurations) ? remote.slotDurations : [],
      sortOrder: catalogItem.sortOrder,
    })
  }

  products.sort((a, b) => {
    const catA =
      ACCOUNT_SHOP_CATEGORIES.find((item) => item.id === a.categoryId)?.sortOrder ?? 99
    const catB =
      ACCOUNT_SHOP_CATEGORIES.find((item) => item.id === b.categoryId)?.sortOrder ?? 99
    if (catA !== catB) return catA - catB
    return a.sortOrder - b.sortOrder
  })

  const presentCategories = new Set(products.map((item) => item.categoryId))

  return {
    usdtIrtPrice,
    categories: ACCOUNT_SHOP_CATEGORIES.filter((item) => presentCategories.has(item.id)).map(
      (item) => ({ id: item.id, label: item.labelFa }),
    ),
    products,
  }
}

export { CanbosoApiError }
