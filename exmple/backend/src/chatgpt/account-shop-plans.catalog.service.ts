import {
  ACCOUNT_SHOP_CATEGORIES,
  type AccountShopCategoryId,
} from './account-shop.catalog.js'
import {
  asNoticeKind,
  formatWarrantyLabel,
  normalizeCustomFields,
  type AccountShopCustomField,
  type AccountShopNoticeKind,
  type AccountShopPricingMode,
  type AccountShopWarrantyType,
} from '../admin/admin-account-plans.types.js'
import {
  convertUsdtToToman,
  getUsdtIrtPrice,
} from '../crypto-payments/swapwallet.client.js'
import { prisma } from '../db/client.js'
import { roundDisplayTomanUp } from '../pricing/product-pricing.apply.js'
import { getRoboticvnProduct, RoboticvnApiError } from '../roboticvn/roboticvn.client.js'

export type AccountShopPlanProduct = {
  planId: number
  productId: string
  categoryId: AccountShopCategoryId
  categoryLabel: string
  name: string
  shortDesc: string
  durationLabel: string
  warrantyLabel: string
  priceUsd: number | null
  toman: number
  available: number | null
  inStock: boolean
  pricingMode: AccountShopPricingMode
  markupPercent: number
  customFields: AccountShopCustomField[]
  noticeKind: AccountShopNoticeKind
  noticeText: string | null
  sortOrder: number
  /** @deprecated kept for older confirm UI compatibility */
  isSlot: boolean
  requiresCustomerEmail: boolean
  requiresSlotMonths: boolean
  slotDurations: number[]
}

export type AccountShopPlansCatalogResponse = {
  usdtIrtPrice: number
  categories: Array<{ id: AccountShopCategoryId; label: string }>
  products: AccountShopPlanProduct[]
}

function asWarrantyType(value: string): AccountShopWarrantyType {
  if (value === 'full' || value === 'days' || value === 'none') return value
  return 'none'
}

function asPricingMode(value: string): AccountShopPricingMode {
  return value === 'variable' ? 'variable' : 'fixed'
}

function buildShortDesc(durationLabel: string, warrantyLabel: string): string {
  return `${durationLabel} · ${warrantyLabel}`
}

export async function getAccountShopPlansCatalog(
  categoryId?: AccountShopCategoryId,
): Promise<AccountShopPlansCatalogResponse> {
  const [plans, usdtIrtPrice] = await Promise.all([
    prisma.accountShopPlan.findMany({
      where: {
        isActive: true,
        ...(categoryId ? { categoryId } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    }),
    getUsdtIrtPrice().catch(() => 0),
  ])

  const productCache = new Map<
    string,
    Awaited<ReturnType<typeof getRoboticvnProduct>> | null
  >()

  async function loadProduct(productId: string) {
    if (productCache.has(productId)) return productCache.get(productId) ?? null
    try {
      const detail = await getRoboticvnProduct(productId)
      productCache.set(productId, detail)
      return detail
    } catch (error) {
      if (!(error instanceof RoboticvnApiError)) {
        productCache.set(productId, null)
        return null
      }
      productCache.set(productId, null)
      return null
    }
  }

  const products: AccountShopPlanProduct[] = []

  for (const plan of plans) {
    const category = ACCOUNT_SHOP_CATEGORIES.find((item) => item.id === plan.categoryId)
    if (!category) continue

    const warrantyType = asWarrantyType(plan.warrantyType)
    const pricingMode = asPricingMode(plan.pricingMode)
    const warrantyLabel = formatWarrantyLabel(warrantyType, plan.warrantyDays)
    const customFields = normalizeCustomFields(plan.customFields)
    const noticeKind = asNoticeKind(plan.noticeKind)
    const noticeText =
      noticeKind === 'none'
        ? null
        : typeof plan.noticeText === 'string' && plan.noticeText.trim()
          ? plan.noticeText.trim()
          : null

    const detail = await loadProduct(plan.roboticvnProductId)
    const variant = detail?.variants.find((item) => item.id === plan.roboticvnVariantId) ?? null
    const inStock = Boolean(variant?.in_stock && (variant.available_quantity ?? 0) > 0)
    const available = variant?.available_quantity ?? null
    const priceUsd =
      typeof variant?.prices?.usd === 'number' && Number.isFinite(variant.prices.usd)
        ? variant.prices.usd
        : null

    let toman = 0
    if (pricingMode === 'fixed') {
      toman = roundDisplayTomanUp(plan.fixedToman ?? 0)
    } else if (priceUsd != null && usdtIrtPrice > 0) {
      const base = convertUsdtToToman(priceUsd, usdtIrtPrice)
      const withMarkup = base * (1 + plan.markupPercent / 100)
      toman = roundDisplayTomanUp(withMarkup)
    }

    products.push({
      planId: plan.id,
      productId: String(plan.id),
      categoryId: plan.categoryId as AccountShopCategoryId,
      categoryLabel: category.labelFa,
      name: plan.name,
      shortDesc: buildShortDesc(plan.durationLabel, warrantyLabel),
      durationLabel: plan.durationLabel,
      warrantyLabel,
      priceUsd,
      toman,
      available,
      inStock,
      pricingMode,
      markupPercent: plan.markupPercent,
      customFields,
      noticeKind,
      noticeText,
      sortOrder: plan.sortOrder,
      isSlot: false,
      requiresCustomerEmail: false,
      requiresSlotMonths: false,
      slotDurations: [],
    })
  }

  return {
    usdtIrtPrice,
    categories: ACCOUNT_SHOP_CATEGORIES.map((item) => ({
      id: item.id,
      label: item.labelFa,
    })),
    products,
  }
}
