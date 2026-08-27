import {
  convertTonToToman,
  convertUsdtToToman,
  getTonIrtPrice,
  getUsdtIrtPrice,
} from '../crypto-payments/swapwallet.client.js'
import { SHOP_CATEGORIES } from '../orders/shop-category.data.js'
import {
  applyPricingRule,
  getProductPricingRule,
  type ProductPricingRule,
} from '../pricing/product-pricing.apply.js'
import { getStarsPrice } from '../stars/marketapp.client.js'
import {
  readCachedMarketPrice,
  readCachedTonIrtPrice,
  writeCachedMarketPrice,
  writeCachedTonIrtPrice,
} from '../stars/stars-price.cache.js'
import { getPremiumPrices } from '../stars/marketapp.client.js'
import {
  readCachedPremiumPrices,
  writeCachedPremiumPrices,
} from '../premium/premium-price.cache.js'
import { getVirtualNumberCountryGroups } from '../virtual-number/virtual-number-countries.service.js'
import {
  calcReactionItemToman,
  getPowerTelServicesMap,
} from '../reaction/reaction-pricing.js'
import { REACTION_CATALOG } from '../reaction/reaction-catalog.data.js'
import {
  calcChannelViewsToman,
  CHANNEL_VIEW_SERVICE_ID,
} from '../channel-views/channel-views.pricing.js'
import {
  calcTelegramMembersToman,
  TELEGRAM_MEMBER_SERVICE_IDS,
} from '../telegram-members/telegram-members.pricing.js'
import {
  ACCOUNT_SHOP_CATALOG,
  ACCOUNT_SHOP_CATEGORIES,
  ACCOUNT_SHOP_PRODUCT_IDS,
  accountShopProductKey,
  parseAccountShopProductKey,
  type AccountShopCategoryId,
} from '../chatgpt/account-shop.catalog.js'
import { fetchCanbosoProducts } from '../chatgpt/canboso.client.js'
import { SHOP_PRODUCT_KEYS } from '../analytics/analytics.schema.js'

export type AdminPricingCatalogItem = {
  id: string
  label: string
  subtitle: string | null
  group: string | null
  baseToman: number
  finalToman: number
}

export type AdminPricingCatalog = {
  productKey: string
  label: string
  source: string
  note: string | null
  sampleHint: string | null
  items: AdminPricingCatalogItem[]
}

const STARS_SAMPLE_QUANTITIES = [50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000]
const CHANNEL_VIEWS_SAMPLE_QUANTITIES = [100, 500, 1_000, 5_000, 10_000]
const REACTION_SAMPLE_QTY = 100
const MEMBERS_SAMPLE_QTY = 1_000

const MEMBER_LABELS: Record<number, { name: string; shortDesc: string }> = {
  155: { name: 'ممبر فیک ۱ ماه ضمانت', shortDesc: 'گارانتی حدود ۳۰ روز · سرعت بالا' },
  154: { name: 'ممبر فیک ۳ ماه ضمانت', shortDesc: '۹۰ روز بدون ریزش · میکس' },
  153: { name: 'ممبر اجباری هیدن', shortDesc: 'ایرانی واقعی · کانال زیر ۱۰۰ هزار' },
  156: { name: 'ممبر فعال ویو‌دار ۱ ماهه', shortDesc: 'ایرانی · نمودار ویو فالوور' },
  157: { name: 'ممبر فعال ویو‌دار ۲ ماهه', shortDesc: 'ایرانی · ۶۰ روز گارانتی' },
  158: { name: 'ممبر فعال ویو‌دار ۳ ماهه', shortDesc: 'ایرانی · ۹۰ روز گارانتی' },
  161: { name: 'تمدید ممبر ویو‌دار ۱ ماه', shortDesc: 'تمدید ماندگاری ممبر فعال' },
  162: { name: 'ممبر آپلودر واقعی', shortDesc: 'عضویت اجباری از طریق ربات' },
}

function categoryLabel(productKey: string): string {
  return SHOP_CATEGORIES.find((item) => item.slug === productKey)?.label ?? productKey
}

function finalizeItem(
  item: Omit<AdminPricingCatalogItem, 'finalToman'>,
  rule: ProductPricingRule | null,
): AdminPricingCatalogItem {
  return {
    ...item,
    finalToman: applyPricingRule(item.baseToman, rule),
  }
}

async function getTonIrt(): Promise<number> {
  const cached = await readCachedTonIrtPrice()
  if (cached != null) return cached
  const price = await getTonIrtPrice()
  await writeCachedTonIrtPrice(price)
  return price
}

async function getStarsMarket(quantity: number) {
  const cached = await readCachedMarketPrice(quantity)
  if (cached != null) return cached
  const price = await getStarsPrice(quantity)
  await writeCachedMarketPrice(quantity, price)
  return price
}

async function catalogStars(rule: ProductPricingRule | null): Promise<AdminPricingCatalog> {
  const tonIrt = await getTonIrt()
  const results = await Promise.allSettled(
    STARS_SAMPLE_QUANTITIES.map(async (quantity) => {
      const market = await getStarsMarket(quantity)
      const baseToman = convertTonToToman(market.ton, tonIrt)
      return finalizeItem(
        {
          id: `stars-${quantity}`,
          label: `${quantity.toLocaleString('fa-IR')} استارز`,
          subtitle: `${market.ton.toFixed(4)} TON`,
          group: null,
          baseToman,
        },
        rule,
      )
    }),
  )

  const items = results
    .filter((item): item is PromiseFulfilledResult<AdminPricingCatalogItem> => item.status === 'fulfilled')
    .map((item) => item.value)

  return {
    productKey: 'telegram-stars',
    label: categoryLabel('telegram-stars'),
    source: 'MarketApp + SwapWallet',
    note: items.length
      ? null
      : 'دریافت قیمت استارز از وب‌سرویس ناموفق بود',
    sampleHint: 'نمونه‌های رایج تعداد استارز (قیمت پایه از Fragment/MarketApp)',
    items,
  }
}

async function catalogPremium(rule: ProductPricingRule | null): Promise<AdminPricingCatalog> {
  let itemsRaw = await readCachedPremiumPrices()
  if (!itemsRaw) {
    const { items } = await getPremiumPrices()
    await writeCachedPremiumPrices(items)
    itemsRaw = items
  }
  const tonIrt = await getTonIrt()

  const items = itemsRaw.map((item) =>
    finalizeItem(
      {
        id: `premium-${item.months}`,
        label: `${item.months} ماهه`,
        subtitle: `${item.ton.toFixed(4)} TON`,
        group: null,
        baseToman: convertTonToToman(item.ton, tonIrt),
      },
      rule,
    ),
  )

  return {
    productKey: 'telegram-premium',
    label: categoryLabel('telegram-premium'),
    source: 'MarketApp + SwapWallet',
    note: null,
    sampleHint: 'پلن‌های پریمیوم تلگرام',
    items,
  }
}

async function catalogVirtualNumber(rule: ProductPricingRule | null): Promise<AdminPricingCatalog> {
  const { groups } = await getVirtualNumberCountryGroups(true)
  const items = groups.flatMap((group) =>
    group.items.map((item) =>
      finalizeItem(
        {
          id: `vn-${item.countryId}`,
          label: item.country,
          subtitle: item.available
            ? `کیفیت ${group.label}`
            : `کیفیت ${group.label} · ناموجود`,
          group: group.label,
          baseToman: Number(item.price) || 0,
        },
        rule,
      ),
    ),
  )

  return {
    productKey: 'virtual-number',
    label: categoryLabel('virtual-number'),
    source: 'Callinoo (کش ۱۰ دقیقه‌ای)',
    note: items.length ? null : 'لیست کشورها از Callinoo خالی است',
    sampleHint: 'قیمت پایه هر کشور همین الان از وب‌سرویس Callinoo گرفته شده؛ قیمت نهایی با تنظیم ادمین محاسبه می‌شود',
    items,
  }
}

async function catalogReaction(rule: ProductPricingRule | null): Promise<AdminPricingCatalog> {
  const { byId } = await getPowerTelServicesMap()
  const items: AdminPricingCatalogItem[] = []

  for (const entry of REACTION_CATALOG) {
    const service = byId.get(entry.serviceId)
    if (!service) continue
    const baseToman = calcReactionItemToman(REACTION_SAMPLE_QTY, service.rate)
    items.push(
      finalizeItem(
        {
          id: `reaction-${entry.serviceId}`,
          label: `${entry.emoji} · سرویس ${entry.serviceId}`,
          subtitle: `نرخ ${Math.round(service.rate).toLocaleString('fa-IR')} تومان / ۱۰۰۰ · نمونه ${REACTION_SAMPLE_QTY}`,
          group: null,
          baseToman,
        },
        rule,
      ),
    )
  }

  return {
    productKey: 'reaction',
    label: categoryLabel('reaction'),
    source: 'PowerTel',
    note: items.length ? null : 'سرویس‌های ری‌اکشن در PowerTel یافت نشد',
    sampleHint: `قیمت نمونه برای ${REACTION_SAMPLE_QTY} ری‌اکشن از نرخ زنده PowerTel`,
    items,
  }
}

async function catalogChannelViews(rule: ProductPricingRule | null): Promise<AdminPricingCatalog> {
  const { byId } = await getPowerTelServicesMap()
  const service = byId.get(CHANNEL_VIEW_SERVICE_ID)
  if (!service) {
    return {
      productKey: 'channel-views',
      label: categoryLabel('channel-views'),
      source: 'PowerTel',
      note: 'سرویس سین کانال (id=1) در PowerTel در دسترس نیست',
      sampleHint: null,
      items: [],
    }
  }

  const items = CHANNEL_VIEWS_SAMPLE_QUANTITIES.map((quantity) =>
    finalizeItem(
      {
        id: `views-${quantity}`,
        label: `${quantity.toLocaleString('fa-IR')} سین`,
        subtitle: `${service.name} · نرخ ${Math.round(service.rate).toLocaleString('fa-IR')} / ۱۰۰۰`,
        group: null,
        baseToman: calcChannelViewsToman(quantity, service.rate),
      },
      rule,
    ),
  )

  return {
    productKey: 'channel-views',
    label: categoryLabel('channel-views'),
    source: 'PowerTel',
    note: null,
    sampleHint: 'نمونه‌های تعداد بازدید با نرخ زنده PowerTel',
    items,
  }
}

async function catalogMembers(rule: ProductPricingRule | null): Promise<AdminPricingCatalog> {
  const { byId } = await getPowerTelServicesMap()
  const items: AdminPricingCatalogItem[] = []

  for (const serviceId of TELEGRAM_MEMBER_SERVICE_IDS) {
    const service = byId.get(serviceId)
    if (!service) continue
    const labels = MEMBER_LABELS[serviceId]
    const qty = Math.max(MEMBERS_SAMPLE_QTY, service.min)
    items.push(
      finalizeItem(
        {
          id: `members-${serviceId}`,
          label: labels?.name ?? service.name,
          subtitle: `${labels?.shortDesc ?? (service.desc || '—')} · نمونه ${qty.toLocaleString('fa-IR')} · نرخ ${Math.round(service.rate).toLocaleString('fa-IR')} / ۱۰۰۰`,
          group: null,
          baseToman: calcTelegramMembersToman(qty, service.rate),
        },
        rule,
      ),
    )
  }

  return {
    productKey: 'telegram-members',
    label: categoryLabel('telegram-members'),
    source: 'PowerTel',
    note: items.length ? null : 'سرویس‌های ممبر در PowerTel یافت نشد',
    sampleHint: 'انواع ممبر با نرخ زنده PowerTel',
    items,
  }
}

async function catalogChatgpt(
  rule: ProductPricingRule | null,
  categoryId?: AccountShopCategoryId,
): Promise<AdminPricingCatalog> {
  const [remoteProducts, usdtIrtPrice] = await Promise.all([
    fetchCanbosoProducts(),
    getUsdtIrtPrice(),
  ])
  const byId = new Map(remoteProducts.map((item) => [item._id, item]))
  const categoryLabelMap = new Map(
    ACCOUNT_SHOP_CATEGORIES.map((item) => [item.id, item.labelFa] as const),
  )

  const items: AdminPricingCatalogItem[] = []

  for (const catalogItem of ACCOUNT_SHOP_CATALOG) {
    if (categoryId && catalogItem.categoryId !== categoryId) continue
    if (!ACCOUNT_SHOP_PRODUCT_IDS.has(catalogItem.productId)) continue
    const remote = byId.get(catalogItem.productId)
    if (!remote) continue

    const candidates = [remote.usdPricing, remote.walletPricing, remote.pricing]
    let priceUsd = 0
    for (const value of candidates) {
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        priceUsd = value
        break
      }
    }
    if (priceUsd <= 0) continue

    const baseToman = convertUsdtToToman(priceUsd, usdtIrtPrice)
    items.push(
      finalizeItem(
        {
          id: `account-${catalogItem.productId}`,
          label: catalogItem.nameFa,
          subtitle: `${priceUsd}$ · ${catalogItem.shortDescFa}`,
          group: categoryLabelMap.get(catalogItem.categoryId) ?? catalogItem.categoryId,
          baseToman,
        },
        rule,
      ),
    )
  }

  const productKey = categoryId ? accountShopProductKey(categoryId) : 'chatgpt'
  const label = categoryId
    ? (categoryLabelMap.get(categoryId) ?? categoryId)
    : categoryLabel('chatgpt')

  return {
    productKey,
    label,
    source: 'Canboso + SwapWallet',
    note: items.length ? null : 'محصولات اکانت از Canboso دریافت نشد',
    sampleHint: 'قیمت پایه از USD زنده Canboso و نرخ تتر',
    items,
  }
}

function catalogGifts(rule: ProductPricingRule | null): AdminPricingCatalog {
  return {
    productKey: 'telegram-gifts',
    label: categoryLabel('telegram-gifts'),
    source: '—',
    note: 'وب‌سرویس خرید گیفت هنوز متصل نشده؛ فقط تنظیم درصد/مبلغ ثابت برای آینده ذخیره می‌شود',
    sampleHint: null,
    items: [
      finalizeItem(
        {
          id: 'gifts-placeholder',
          label: 'نمونه پایه',
          subtitle: 'پس از اتصال سرویس، آیتم‌های واقعی اینجا می‌آیند',
          group: null,
          baseToman: 100_000,
        },
        rule,
      ),
    ],
  }
}

export async function getAdminPricingCatalog(productKey: string): Promise<AdminPricingCatalog> {
  const accountCategoryId = parseAccountShopProductKey(productKey)
  const known =
    SHOP_CATEGORIES.some((item) => item.slug === productKey) ||
    accountCategoryId != null ||
    SHOP_PRODUCT_KEYS.includes(productKey)
  if (!known) {
    throw Object.assign(new Error('محصول نامعتبر است'), { statusCode: 400 })
  }

  const rule = await getProductPricingRule(productKey)

  try {
    if (accountCategoryId) {
      return await catalogChatgpt(rule, accountCategoryId)
    }

    switch (productKey) {
      case 'telegram-stars':
        return await catalogStars(rule)
      case 'telegram-premium':
        return await catalogPremium(rule)
      case 'virtual-number':
        return await catalogVirtualNumber(rule)
      case 'reaction':
        return await catalogReaction(rule)
      case 'channel-views':
        return await catalogChannelViews(rule)
      case 'telegram-members':
        return await catalogMembers(rule)
      case 'chatgpt':
        return await catalogChatgpt(rule)
      case 'telegram-gifts':
        return catalogGifts(rule)
      default:
        throw Object.assign(new Error('محصول نامعتبر است'), { statusCode: 400 })
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    const message = error instanceof Error ? error.message : 'خطا در دریافت کاتالوگ قیمت'
    return {
      productKey,
      label: accountCategoryId
        ? (ACCOUNT_SHOP_CATEGORIES.find((item) => item.id === accountCategoryId)?.labelFa ??
          productKey)
        : categoryLabel(productKey),
      source: '—',
      note: message,
      sampleHint: null,
      items: [],
    }
  }
}
