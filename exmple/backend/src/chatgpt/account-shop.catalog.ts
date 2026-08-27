export type AccountShopCategoryId =
  | 'chatgpt'
  | 'gemini'
  | 'capcut'
  | 'canva'
  | 'youtube'
  | 'microsoft'
  | 'claude'
  | 'cursor'
  | 'netflix'
  | 'grok'

export type AccountShopCatalogItem = {
  productId: string
  categoryId: AccountShopCategoryId
  nameFa: string
  shortDescFa: string
  sortOrder: number
}

export const ACCOUNT_SHOP_CATEGORIES: Array<{
  id: AccountShopCategoryId
  labelFa: string
  sortOrder: number
}> = [
  { id: 'chatgpt', labelFa: 'چت‌جی‌پی‌تی', sortOrder: 1 },
  { id: 'gemini', labelFa: 'گوگل جمینای', sortOrder: 2 },
  { id: 'capcut', labelFa: 'کپ‌کات پرو', sortOrder: 3 },
  { id: 'canva', labelFa: 'کانوا', sortOrder: 4 },
  { id: 'youtube', labelFa: 'یوتیوب', sortOrder: 5 },
  { id: 'microsoft', labelFa: 'مایکروسافت', sortOrder: 6 },
  { id: 'claude', labelFa: 'کلاد AI', sortOrder: 7 },
  { id: 'cursor', labelFa: 'کرسر پرو', sortOrder: 8 },
  { id: 'netflix', labelFa: 'نتفلیکس', sortOrder: 9 },
  { id: 'grok', labelFa: 'گروک', sortOrder: 10 },
]

/** Product key prefix so each brand is tracked/priced as its own shop product. */
export const ACCOUNT_SHOP_PRODUCT_KEY_PREFIX = 'account-' as const

export function accountShopProductKey(categoryId: AccountShopCategoryId): string {
  return `${ACCOUNT_SHOP_PRODUCT_KEY_PREFIX}${categoryId}`
}

export function parseAccountShopProductKey(productKey: string): AccountShopCategoryId | null {
  const normalized = productKey.trim().toLowerCase()
  if (!normalized.startsWith(ACCOUNT_SHOP_PRODUCT_KEY_PREFIX)) return null
  const categoryId = normalized.slice(ACCOUNT_SHOP_PRODUCT_KEY_PREFIX.length)
  const match = ACCOUNT_SHOP_CATEGORIES.find((item) => item.id === categoryId)
  return match?.id ?? null
}

export const ACCOUNT_SHOP_PRODUCT_KEYS: readonly string[] = ACCOUNT_SHOP_CATEGORIES.map((item) =>
  accountShopProductKey(item.id),
)

export function isAccountShopCategoryId(value: string): value is AccountShopCategoryId {
  return ACCOUNT_SHOP_CATEGORIES.some((item) => item.id === value)
}

/** Curated Canboso products shown in the account shop */
export const ACCOUNT_SHOP_CATALOG: AccountShopCatalogItem[] = [
  // ChatGPT
  {
    productId: '6a60a82a5e69f358e46ec7b6',
    categoryId: 'chatgpt',
    nameFa: 'چت‌جی‌پی‌تی پلاس · ۱ ماه',
    shortDescFa: 'اکانت کامل · گارانتی ۳۰ روزه',
    sortOrder: 1,
  },
  {
    productId: '6a6089b56e4a364492f017b6',
    categoryId: 'chatgpt',
    nameFa: 'چت‌جی‌پی‌تی پلاس · ۱ ماه',
    shortDescFa: 'اکانت آماده · گارانتی کامل',
    sortOrder: 2,
  },
  {
    productId: '6a5ee95dfe6a1e7c615c3bd3',
    categoryId: 'chatgpt',
    nameFa: 'چت‌جی‌پی‌تی پلاس · اپل‌پی',
    shortDescFa: 'جیمیل · گارانتی ۳۰ روزه',
    sortOrder: 3,
  },
  {
    productId: '6a60a83e5e69f358e46ec9bc',
    categoryId: 'chatgpt',
    nameFa: 'چت‌جی‌پی‌تی پلاس · جیمیل قوی',
    shortDescFa: '۱ ماه · گارانتی ۱۵ روزه',
    sortOrder: 4,
  },
  {
    productId: '6a5ee92ffe6a1e7c615c37ee',
    categoryId: 'chatgpt',
    nameFa: 'چت‌جی‌پی‌تی پلاس · اپل‌پی',
    shortDescFa: 'جیمیل · گارانتی ۱۵ روزه',
    sortOrder: 5,
  },
  {
    productId: '6a5f9ab92e7aa03102c60101',
    categoryId: 'chatgpt',
    nameFa: 'چت‌جی‌پی‌تی پلاس · اپل‌پی',
    shortDescFa: 'آیکلود یا جیمیل · گارانتی ۱ روزه',
    sortOrder: 6,
  },
  {
    productId: '6a60bb805e69f358e470e246',
    categoryId: 'chatgpt',
    nameFa: 'چت‌جی‌پی‌تی پلاس · سطح بالا',
    shortDescFa: '۳۰ روزه · گارانتی ۷ روزه',
    sortOrder: 7,
  },

  // Gemini
  {
    productId: '6a4158409e3f5692440d3a1e',
    categoryId: 'gemini',
    nameFa: 'اسلات جمینای پرو · ۱ سال',
    shortDescFa: 'مالک رسمی · گارانتی ۲۴ ساعته',
    sortOrder: 1,
  },

  // CapCut
  {
    productId: '6a60f8becfb6885dfa772281',
    categoryId: 'capcut',
    nameFa: 'کپ‌کات پرو · ۷ روز',
    shortDescFa: 'اکانت آماده · گارانتی کامل',
    sortOrder: 1,
  },
  {
    productId: '6a4320657a2925020839f5cc',
    categoryId: 'capcut',
    nameFa: 'کپ‌کات پرو · ۱ ماه',
    shortDescFa: 'اکانت آماده · گارانتی کامل',
    sortOrder: 2,
  },
  {
    productId: '6a45dd450a30fb5e8d7a09ae',
    categoryId: 'capcut',
    nameFa: 'کپ‌کات · ۳ ماه',
    shortDescFa: 'اکانت آماده · گارانتی کامل',
    sortOrder: 3,
  },
  {
    productId: '6a45dd600a30fb5e8d7a0e2b',
    categoryId: 'capcut',
    nameFa: 'کپ‌کات · ۶ ماه',
    shortDescFa: 'اکانت آماده · گارانتی کامل',
    sortOrder: 4,
  },
  {
    productId: '6a45dd6c0a30fb5e8d7a0f60',
    categoryId: 'capcut',
    nameFa: 'کپ‌کات · ۱ سال',
    shortDescFa: 'اکانت آماده · گارانتی کامل',
    sortOrder: 5,
  },

  // Canva
  {
    productId: '6a55524c8d08ecf1c0a42ca1',
    categoryId: 'canva',
    nameFa: 'اسلات کانوا EDU · ۱ سال',
    shortDescFa: 'افزودن به خانواده · گارانتی کامل',
    sortOrder: 1,
  },
  {
    productId: '6a5b75f5e7f1b93d2a1b4d74',
    categoryId: 'canva',
    nameFa: 'اسلات کانوا پرو · ۱ سال',
    shortDescFa: 'گارانتی کامل',
    sortOrder: 2,
  },

  // YouTube
  {
    productId: '6a4dfe663450ba4fbb9ccadf',
    categoryId: 'youtube',
    nameFa: 'اسلات یوتیوب پریمیوم · ۱ ماه',
    shortDescFa: '۳۰ روزه',
    sortOrder: 1,
  },
  {
    productId: '6a5e2a87fe6a1e7c614e0e71',
    categoryId: 'youtube',
    nameFa: 'یوتیوب پریمیوم · ۳ ماه',
    shortDescFa: 'اسلات جدا · گارانتی کامل',
    sortOrder: 2,
  },
  {
    productId: '6a4dfe963450ba4fbb9cd1fb',
    categoryId: 'youtube',
    nameFa: 'اسلات یوتیوب پریمیوم · ۶ ماه',
    shortDescFa: 'اسلات آماده',
    sortOrder: 3,
  },
  {
    productId: '6a43a1017a292502084e4618',
    categoryId: 'youtube',
    nameFa: 'یوتیوب پریمیوم · ۱۲ ماه',
    shortDescFa: 'اسلات جدا · گارانتی کامل',
    sortOrder: 4,
  },
  {
    productId: '6a43a0d67a292502084e4134',
    categoryId: 'youtube',
    nameFa: 'اسلات یوتیوب پریمیوم · ۱۲ ماه',
    shortDescFa: 'اسلات آماده',
    sortOrder: 5,
  },

  // Microsoft
  {
    productId: '6a5db37a528addef252e895a',
    categoryId: 'microsoft',
    nameFa: 'مایکروسافت ۳۶۵ شخصی · ۱۳ ماه',
    shortDescFa: '۱ سال + ۱ ماه',
    sortOrder: 1,
  },
  {
    productId: '6a5627544fd2c42ecc755a36',
    categoryId: 'microsoft',
    nameFa: 'آفیس ۳۶۵ · ۱۰۰ گیگ',
    shortDescFa: '۵ دستگاه · گارانتی ۲ ساله',
    sortOrder: 2,
  },
  {
    productId: '6a530530b2b03f15129e2f77',
    categoryId: 'microsoft',
    nameFa: 'آفیس ۳۶۵ فمیلی · ۸ ماه',
    shortDescFa: 'ادمین · افزودن ۵ عضو',
    sortOrder: 3,
  },

  // Claude
  {
    productId: '6a5e5338fe6a1e7c615299cd',
    categoryId: 'claude',
    nameFa: 'کلاد مکس ×۵ · ۱ ماه',
    shortDescFa: 'گارانتی ۳۰ روزه',
    sortOrder: 1,
  },
  {
    productId: '6a5e0e76bef04b4b6ce97f3f',
    categoryId: 'claude',
    nameFa: 'کلاد مکس ×۲۰ · ۱ ماه',
    shortDescFa: 'گارانتی ۳۰ روزه',
    sortOrder: 2,
  },

  // Cursor
  {
    productId: '6a3ca83d7a57ae0e4dbb83ab',
    categoryId: 'cursor',
    nameFa: 'کرسر پرو API · ۲۶۰۰ اعتبار',
    shortDescFa: '۱ ماه · گارانتی کامل',
    sortOrder: 1,
  },
  {
    productId: '6a47d2ef9ad6f6fd409dac84',
    categoryId: 'cursor',
    nameFa: 'کرسر پرو API · ۶۵۰۰ اعتبار',
    shortDescFa: '۱ ماه · گارانتی کامل',
    sortOrder: 2,
  },
  {
    productId: '6a3e31cecc06fe4bc3786079',
    categoryId: 'cursor',
    nameFa: 'کرسر پرو API · ۲۰۰ اعتبار روزانه',
    shortDescFa: '۱ ماه · گارانتی کامل',
    sortOrder: 3,
  },
  {
    productId: '6a604d43d3abd7279890358b',
    categoryId: 'cursor',
    nameFa: 'کرسر پرو · ۱ ماه',
    shortDescFa: 'اکانت کامل · گارانتی کامل',
    sortOrder: 4,
  },
  {
    productId: '6a604d4dd3abd72798903729',
    categoryId: 'cursor',
    nameFa: 'کرسر اولترا · ۱ ماه',
    shortDescFa: 'اکانت کامل · گارانتی کامل',
    sortOrder: 5,
  },

  // Netflix
  {
    productId: '6a5c72662ebc86e4b9e430e5',
    categoryId: 'netflix',
    nameFa: 'نتفلیکس پریمیوم ۴K · ۱ ماه',
    shortDescFa: 'گارانتی کامل',
    sortOrder: 1,
  },

  // Grok
  {
    productId: '6a5ee849fe6a1e7c615c1cf8',
    categoryId: 'grok',
    nameFa: 'سوپر گروک',
    shortDescFa: 'آپگرید این‌اپ · پوشش کامل',
    sortOrder: 1,
  },
]

export const ACCOUNT_SHOP_PRODUCT_IDS = new Set(
  ACCOUNT_SHOP_CATALOG.map((item) => item.productId),
)
