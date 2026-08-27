import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import SearchIcon from '../components/icons/SearchIcon'
import { EmptyState } from '../components/EmptyState'
import { ShopAutoServices } from '../components/ShopAutoServices'
import { ShopBanners } from '../components/ShopBanners'
import { ShopHighlights } from '../components/ShopHighlights'
import { ShopPopularRails } from '../components/ShopPopularRails'
import { ShopSpotlight } from '../components/ShopSpotlight'
import { shopCategories } from '../data/shopCategories'
import { shopHeroRoutes } from '../data/shopHeroPages'
import {
  accountShopRoute,
  parseAccountShopProductKey,
} from '../data/accountShopProducts'
import { useTelegram } from '../hooks/useTelegram'
import '../styles/shop-rise.css'
import './Shop.css'

const categoryRoutes: Record<string, string> = {
  'telegram-stars': '/stars',
  'telegram-premium': '/premium',
  ...shopHeroRoutes,
}

export function ShopPage() {
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearchResults, setShowSearchResults] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchResultsRef = useRef<HTMLDivElement>(null)

  const trimmedQuery = searchQuery.trim()
  const filteredCategories = trimmedQuery
    ? shopCategories.filter((category) =>
        category.label.toLowerCase().includes(trimmedQuery.toLowerCase()),
      )
    : []

  useEffect(() => {
    if (!trimmedQuery) {
      setShowSearchResults(false)
      return
    }

    setShowSearchResults(true)
  }, [trimmedQuery])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        searchResultsRef.current?.contains(target) ||
        searchInputRef.current?.contains(target)
      ) {
        return
      }

      setShowSearchResults(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleCategoryClick = (categoryId: string, isActive: boolean) => {
    if (!isActive) return
    haptic('light')
    const accountId = parseAccountShopProductKey(categoryId)
    if (accountId) {
      navigate(accountShopRoute(accountId))
      return
    }
    const route = categoryRoutes[categoryId]
    if (route) {
      navigate(route)
    }
  }

  const handleSearch = () => {
    haptic('light')
    if (trimmedQuery) {
      setShowSearchResults(true)
      searchInputRef.current?.focus()
    }
  }

  const handleCategorySelect = (categoryId: string, isActive: boolean) => {
    handleCategoryClick(categoryId, isActive)
    setSearchQuery('')
    setShowSearchResults(false)
  }

  return (
    <div className="shop">
      <div className="shop__search shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <div className="shop__search-row">
          <button
            type="button"
            className="shop__search-btn"
            onClick={handleSearch}
            aria-label="جستجو"
          >
            <SearchIcon width={18} height={18} color="#ffffff" />
          </button>

          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => {
              if (trimmedQuery && filteredCategories.length > 0) {
                setShowSearchResults(true)
              }
            }}
            placeholder="جستجو..."
            dir="rtl"
            className="shop__search-input"
            aria-label="جستجو در دسته‌بندی‌ها"
          />
        </div>

        {showSearchResults && trimmedQuery && (
          <div ref={searchResultsRef} className="shop__search-results">
            {filteredCategories.length === 0 ? (
              <EmptyState compact title="موردی یافت نشد" />
            ) : (
              <ul className="shop__search-list">
                {filteredCategories.map((category) => {
                  const Icon = category.icon

                  return (
                    <li key={category.id}>
                      <button
                        type="button"
                        className="shop__search-item"
                        onClick={() => handleCategorySelect(category.id, category.isActive)}
                        disabled={!category.isActive}
                      >
                        <span
                          className="shop__search-item-icon"
                          style={{ background: category.gradient }}
                        >
                          <Icon width={18} height={18} color="#ffffff" />
                        </span>
                        <span className="shop__search-item-label">{category.label}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      <ShopBanners onBannerClick={(categoryId) => {
        if (!categoryId) return
        handleCategoryClick(categoryId, true)
      }} />

      <section className="shop__categories" aria-label="دسته‌بندی‌ها">
        <h2 className="shop__categories-title shop-rise" style={{ '--rise-index': 4 } as CSSProperties}>
          دسته‌بندی‌ها
        </h2>

        <div className="shop__categories-grid shop-rise" style={{ '--rise-index': 5 } as CSSProperties}>
          {shopCategories.map((category) => {
            const Icon = category.icon

            return (
              <button
                key={category.id}
                type="button"
                className={`shop__category${category.isActive ? '' : ' shop__category--disabled'}`}
                onClick={() => handleCategoryClick(category.id, category.isActive)}
                disabled={!category.isActive}
              >
                <span
                  className="shop__category-icon-wrap"
                  style={{ background: category.gradient }}
                >
                  <Icon width={24} height={24} color={category.iconColor ?? '#ffffff'} />
                  {!category.isActive && (
                    <span className="shop__category-badge">به زودی</span>
                  )}
                </span>
                <span className="shop__category-label">{category.label}</span>
              </button>
            )
          })}
        </div>
      </section>

      <ShopSpotlight riseIndex={6} onSelect={handleCategoryClick} />

      <ShopPopularRails
        riseIndex={7}
        onSelect={(productKey, isActive) => handleCategoryClick(productKey, isActive)}
      />

      <ShopAutoServices riseIndex={8} />

      <ShopHighlights riseIndex={9} />
    </div>
  )
}
