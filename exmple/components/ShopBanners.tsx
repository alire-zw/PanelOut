import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { ShopBannerImg } from './ShopBannerImg'
import {
  fetchShopBanners,
  readLocalShopBanners,
  syncShopBanners,
  writeLocalShopBanners,
  type ShopBannerItem,
  type ShopBannersPayload,
} from '../lib/shopBanners'
import { warmShopBannerImageCache } from '../lib/shopBannerImageCache'
import { useTelegram } from '../hooks/useTelegram'
import '../styles/shop-rise.css'
import './ShopBanners.css'

const ROTATE_MS = 5000

interface ShopBannersProps {
  onBannerClick?: (categoryId?: string) => void
}

function pickBanner(items: ShopBannerItem[], index: number): ShopBannerItem | null {
  if (items.length === 0) return null
  return items[((index % items.length) + items.length) % items.length] ?? null
}

function BannerSlot({
  items,
  activeIndex,
  variant,
  onSelect,
}: {
  items: ShopBannerItem[]
  activeIndex: number
  variant: 'main' | 'side'
  onSelect: (productKey: string) => void
}) {
  const active = pickBanner(items, activeIndex)
  if (!active) return null

  return (
    <button
      type="button"
      className={`shop-banners__item shop-banners__item--${variant === 'main' ? 'main' : 'small'}`}
      onClick={() => onSelect(active.productKey)}
      aria-label={active.title}
    >
      {items.map((item, index) => {
        const isActive = index === ((activeIndex % items.length) + items.length) % items.length
        const url = variant === 'main' ? item.mainImageUrl : item.thumbImageUrl

        return (
          <ShopBannerImg
            key={`${variant}-${item.id}`}
            url={url}
            alt={isActive ? item.title : ''}
            className={`shop-banners__image${isActive ? ' is-active' : ''}`}
            priority={variant === 'main' && isActive}
          />
        )
      })}
    </button>
  )
}

function ShopBannersSkeleton() {
  return (
    <section className="shop-banners" aria-busy="true" aria-label="در حال بارگذاری بنرها">
      <div className="shop-banners__row">
        <div className="shop-banners__skeleton shop-banners__skeleton--main" />
        <div className="shop-banners__side">
          <div className="shop-banners__skeleton shop-banners__skeleton--small" />
          <div className="shop-banners__skeleton shop-banners__skeleton--small" />
        </div>
      </div>
    </section>
  )
}

export function ShopBanners({ onBannerClick }: ShopBannersProps) {
  const { haptic } = useTelegram()
  const [items, setItems] = useState<ShopBannerItem[]>(() => readLocalShopBanners()?.items ?? [])
  const [version, setVersion] = useState<string | null>(() => readLocalShopBanners()?.version ?? null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [loading, setLoading] = useState(() => !readLocalShopBanners())

  const applyPayload = useCallback((payload: ShopBannersPayload) => {
    writeLocalShopBanners(payload)
    setItems(payload.items)
    setVersion(payload.version)
    const urls = payload.items.flatMap((item) => [item.mainImageUrl, item.thumbImageUrl])
    void warmShopBannerImageCache(urls)
  }, [])

  const refreshInBackground = useCallback(
    async (currentVersion?: string | null) => {
      try {
        const syncResult = await syncShopBanners(currentVersion ?? undefined)
        if (syncResult.changed) {
          applyPayload(syncResult)
        }
      } catch {
        // background sync should not block shop
      }
    },
    [applyPayload],
  )

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const localCache = readLocalShopBanners()
      if (localCache) {
        if (!cancelled) {
          setItems(localCache.items)
          setVersion(localCache.version)
          setLoading(false)
          void warmShopBannerImageCache(
            localCache.items.flatMap((item) => [item.mainImageUrl, item.thumbImageUrl]),
          )
        }
        void refreshInBackground(localCache.version)
        return
      }

      if (!cancelled) setLoading(true)
      try {
        const payload = await fetchShopBanners()
        if (cancelled) return
        applyPayload(payload)
      } catch {
        if (!cancelled) setItems([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [applyPayload, refreshInBackground])

  useEffect(() => {
    if (items.length <= 1) {
      setActiveIndex(0)
      return undefined
    }

    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % items.length)
    }, ROTATE_MS)

    return () => window.clearInterval(timer)
  }, [items.length])

  useEffect(() => {
    if (items.length === 0) return
    setActiveIndex((prev) => prev % items.length)
  }, [items.length])

  const handleClick = (categoryId?: string) => {
    if (!categoryId) return
    haptic('light')
    onBannerClick?.(categoryId)
  }

  if (loading) {
    return (
      <div className="shop-rise" style={{ '--rise-index': 1 } as CSSProperties}>
        <ShopBannersSkeleton />
      </div>
    )
  }

  if (items.length === 0) {
    return null
  }

  const sideTopIndex = activeIndex + 1
  const sideBottomIndex = activeIndex + 2

  return (
    <section
      className="shop-banners shop-rise"
      style={{ '--rise-index': 1 } as CSSProperties}
      aria-label="بنرها"
      data-version={version ?? undefined}
    >
      <div className="shop-banners__row">
        <BannerSlot
          items={items}
          activeIndex={activeIndex}
          variant="main"
          onSelect={handleClick}
        />

        <div className="shop-banners__side">
          <BannerSlot
            items={items}
            activeIndex={sideTopIndex}
            variant="side"
            onSelect={handleClick}
          />
          <BannerSlot
            items={items}
            activeIndex={sideBottomIndex}
            variant="side"
            onSelect={handleClick}
          />
        </div>
      </div>
    </section>
  )
}
