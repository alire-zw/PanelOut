import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import ChatGPTIcon from './icons/ChatGPTIcon'
import { ACCOUNT_SHOP_CATEGORY_OPTIONS } from '../data/accountShopCategories'
import {
  accountShopProductKey,
  parseAccountShopProductKey,
} from '../data/accountShopProducts'
import { shopCategories, type ShopCategory } from '../data/shopCategories'
import {
  fetchShopPopular,
  readLocalShopPopular,
  writeLocalShopPopular,
  type ShopPopularItem,
  type ShopPopularPayload,
} from '../lib/shopPopular'
import { useTelegram } from '../hooks/useTelegram'
import '../styles/shop-rise.css'
import './ShopPopularRails.css'

type ShopPopularRailsProps = {
  riseIndex: number
  onSelect: (productKey: string, isActive: boolean) => void
}

type ResolvedPopularItem = {
  productKey: string
  label: string
  isActive: boolean
  gradient: string
  iconColor?: string
  imageSrc: string | null
  Icon: ShopCategory['icon'] | null
}

/** Short qualitative labels — never expose raw order counts to users. */
const POPULAR_BADGES = [
  'پرخریدار',
  'محبوب',
  'پربازدید',
  'پرفروش',
  'پیشنهادی',
  'ویژه',
  'ترند',
  'منتخب',
] as const

function popularBadge(index: number): string {
  return POPULAR_BADGES[index] ?? 'پیشنهادی'
}

function resolvePopularItem(productKey: string): ResolvedPopularItem | null {
  const accountId = parseAccountShopProductKey(productKey)
  if (accountId) {
    const account = ACCOUNT_SHOP_CATEGORY_OPTIONS.find((item) => item.id === accountId)
    if (!account) return null
    return {
      productKey,
      label: account.label,
      isActive: true,
      gradient: account.gradient,
      imageSrc: account.stillImageSrc ?? account.imageSrc,
      Icon: ChatGPTIcon,
    }
  }

  // Legacy/aggregated chatgpt sales → show as ChatGPT account card
  if (productKey === 'chatgpt') {
    const account = ACCOUNT_SHOP_CATEGORY_OPTIONS.find((item) => item.id === 'chatgpt')
    if (account) {
      return {
        productKey: accountShopProductKey('chatgpt'),
        label: account.label,
        isActive: true,
        gradient: account.gradient,
        imageSrc: account.stillImageSrc ?? account.imageSrc,
        Icon: ChatGPTIcon,
      }
    }
  }

  const category = shopCategories.find((item) => item.id === productKey)
  if (!category) return null
  return {
    productKey,
    label: category.label,
    isActive: category.isActive,
    gradient: category.gradient,
    iconColor: category.iconColor,
    imageSrc: null,
    Icon: category.icon,
  }
}

function catalogFallbackItems(): ShopPopularItem[] {
  const shop = shopCategories
    .filter((item) => item.isActive && item.id !== 'chatgpt')
    .map((item) => ({
      productKey: item.id,
      label: item.label,
      count: 0,
    }))
  const accounts = ACCOUNT_SHOP_CATEGORY_OPTIONS.map((item) => ({
    productKey: accountShopProductKey(item.id),
    label: item.label,
    count: 0,
  }))
  return [...shop, ...accounts]
}

/** Keep API order, then append missing catalog products so the rail stays full. */
function fillPopularList(items: ShopPopularItem[], limit = 8): ShopPopularItem[] {
  const seen = new Set<string>()
  const result: ShopPopularItem[] = []

  for (const item of items) {
    const key = item.productKey === 'chatgpt' ? accountShopProductKey('chatgpt') : item.productKey
    if (seen.has(key)) continue
    seen.add(key)
    result.push({ ...item, productKey: key })
  }

  for (const item of catalogFallbackItems()) {
    if (result.length >= limit) break
    if (seen.has(item.productKey)) continue
    seen.add(item.productKey)
    result.push(item)
  }

  return result.slice(0, limit)
}

function BestsellerRail({
  items,
  riseIndex,
  onSelect,
}: {
  items: ShopPopularItem[]
  riseIndex: number
  onSelect: (productKey: string, isActive: boolean) => void
}) {
  const { haptic } = useTelegram()
  const visible = items
    .map((item) => ({ item, resolved: resolvePopularItem(item.productKey) }))
    .filter((entry): entry is { item: ShopPopularItem; resolved: ResolvedPopularItem } =>
      Boolean(entry.resolved),
    )
    .slice(0, 8)

  if (visible.length === 0) {
    return null
  }

  return (
    <section
      className="shop-popular shop-rise"
      style={{ '--rise-index': riseIndex } as CSSProperties}
      aria-label="پرفروش‌ترین محصولات"
    >
      <div className="shop-popular__head">
        <h2 className="shop-popular__title">
          <span className="shop-popular__title-accent">پرفروش</span>‌ترین‌ها
        </h2>
        <span className="shop-popular__hint">محبوب‌ترین انتخاب‌ها</span>
      </div>

      <div className="shop-popular__scroller" dir="rtl">
        {visible.map(({ resolved }, index) => {
          const Icon = resolved.Icon
          const selectKey = resolved.productKey

          return (
            <button
              key={`best-${selectKey}`}
              type="button"
              className={`shop-popular__card${resolved.isActive ? '' : ' shop-popular__card--disabled'}`}
              style={{ '--card-gradient': resolved.gradient } as CSSProperties}
              disabled={!resolved.isActive}
              onClick={() => {
                if (!resolved.isActive) return
                haptic('light')
                onSelect(selectKey, resolved.isActive)
              }}
            >
              <span className="shop-popular__rank" aria-hidden="true">
                {(index + 1).toLocaleString('fa-IR')}
              </span>

              <span
                className={`shop-popular__icon${resolved.imageSrc ? ' shop-popular__icon--account' : ''}`}
              >
                {resolved.imageSrc ? (
                  <img src={resolved.imageSrc} alt="" width={32} height={32} draggable={false} />
                ) : Icon ? (
                  <Icon width={18} height={18} color={resolved.iconColor ?? '#ffffff'} />
                ) : null}
              </span>

              <span className="shop-popular__label">{resolved.label}</span>
              <span className="shop-popular__metric">{popularBadge(index)}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function PopularSkeleton({ riseIndex }: { riseIndex: number }) {
  return (
    <div
      className="shop-popular shop-rise"
      style={{ '--rise-index': riseIndex } as CSSProperties}
      aria-busy="true"
    >
      <div className="shop-popular__title-skel" />
      <div className="shop-popular__scroller">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={`best-skel-${index}`} className="shop-popular__card-skel" />
        ))}
      </div>
    </div>
  )
}

export function ShopPopularRails({ riseIndex, onSelect }: ShopPopularRailsProps) {
  const cached = readLocalShopPopular()
  const [payload, setPayload] = useState<ShopPopularPayload | null>(() => cached)

  useEffect(() => {
    let cancelled = false

    const apply = (data: ShopPopularPayload) => {
      writeLocalShopPopular(data)
      if (!cancelled) setPayload(data)
    }

    const local = readLocalShopPopular()
    if (local && !cancelled) {
      setPayload(local)
    }

    void fetchShopPopular()
      .then((data) => {
        if (cancelled) return
        apply(data)
      })
      .catch(() => {
        if (cancelled) return
        if (local) return

        const fallback = catalogFallbackItems().slice(0, 8)
        apply({
          bestsellers: fallback,
          mostViewed: fallback,
          cachedAt: new Date().toISOString(),
        })
      })

    return () => {
      cancelled = true
    }
  }, [])

  const items = useMemo(
    () => fillPopularList(payload?.bestsellers ?? []),
    [payload],
  )

  if (!payload) {
    return <PopularSkeleton riseIndex={riseIndex} />
  }

  return <BestsellerRail items={items} riseIndex={riseIndex} onSelect={onSelect} />
}
