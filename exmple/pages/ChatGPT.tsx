import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { ACCOUNT_SHOP_CATEGORY_OPTIONS } from '../data/accountShopCategories'
import { accountShopRoute } from '../data/accountShopProducts'
import { shopHeroPages } from '../data/shopHeroPages'
import { useTelegram } from '../hooks/useTelegram'
import { isTelegramWebApp } from '../lib/api'
import type { AccountShopCategoryId } from '../lib/chatgpt'
import '../styles/shop-rise.css'
import './ChatGPT.css'

const heroConfig = shopHeroPages.chatgpt

export function ChatGPTPage() {
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const [selectedCategoryId, setSelectedCategoryId] = useState<AccountShopCategoryId | null>(null)
  const [animatedReady, setAnimatedReady] = useState(false)
  const animatedRef = useRef<HTMLImageElement>(null)

  const handleBack = useCallback(() => navigate(-1), [navigate])

  useEffect(() => {
    if (!isTelegramWebApp()) return

    const backButton = window.Telegram?.WebApp.BackButton
    if (!backButton) return

    backButton.show()
    backButton.onClick(handleBack)

    return () => {
      backButton.hide()
      backButton.offClick(handleBack)
    }
  }, [handleBack])

  useEffect(() => {
    const img = animatedRef.current
    if (img?.complete && img.naturalWidth > 0) {
      setAnimatedReady(true)
    }
  }, [])

  const selectedCategory =
    ACCOUNT_SHOP_CATEGORY_OPTIONS.find((item) => item.id === selectedCategoryId) ?? null

  const handleContinue = () => {
    if (!selectedCategory) return
    haptic('light')
    navigate(accountShopRoute(selectedCategory.id))
  }

  return (
    <div className="account-shop">
      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title="خرید اکانت" onBack={handleBack} />
      </div>

      <div className="account-shop__body">
        <section
          className="account-shop__hero shop-rise"
          style={{ '--rise-index': 1 } as CSSProperties}
          aria-label="خرید اکانت"
        >
          <div className="account-shop__image-wrap" aria-hidden>
            <div className="account-shop__image-glow" />
            <img
              src={heroConfig.stillSrc}
              alt=""
              className={`account-shop__image account-shop__image--still${
                animatedReady ? ' account-shop__image--hidden' : ''
              }`}
              width={90}
              height={90}
              fetchPriority="high"
              decoding="async"
            />
            <img
              ref={animatedRef}
              src={heroConfig.animatedSrc}
              alt=""
              className={`account-shop__image account-shop__image--animated${
                animatedReady ? ' account-shop__image--visible' : ''
              }`}
              width={90}
              height={90}
              decoding="async"
              onLoad={() => setAnimatedReady(true)}
            />
          </div>

          <p className="account-shop__desc">
            نوع اکانت موردنظر را انتخاب کنید تا محصولات مرتبط را ببینید.
            <span className="account-shop__desc-accent"> تحویل آنی پس از پرداخت.</span>
          </p>
        </section>

        <section
          className="account-shop__categories shop-rise"
          style={{ '--rise-index': 2 } as CSSProperties}
          aria-label="دسته‌بندی اکانت‌ها"
        >
          <div className="account-shop__section-head">
            <h2 className="account-shop__section-title">دسته‌بندی</h2>
          </div>

          <div className="account-shop__list" role="list">
            {ACCOUNT_SHOP_CATEGORY_OPTIONS.map((category) => {
              const isSelected = selectedCategoryId === category.id

              return (
                <button
                  key={category.id}
                  type="button"
                  role="listitem"
                  className={`account-shop__row${
                    isSelected ? ' account-shop__row--selected' : ''
                  }`}
                  onClick={() => {
                    haptic('light')
                    setSelectedCategoryId(category.id)
                  }}
                >
                  <span className="account-shop__row-text">
                    <span className="account-shop__row-name">{category.label}</span>
                    <span className="account-shop__row-desc">{category.shortDesc}</span>
                  </span>
                  <span className="account-shop__row-thumb" aria-hidden>
                    {category.imageSrc ? (
                      <img
                        src={category.imageSrc}
                        alt=""
                        width={40}
                        height={40}
                        loading="eager"
                        decoding="async"
                        draggable={false}
                      />
                    ) : (
                      <span className="account-shop__row-thumb-fallback">
                        {category.label.charAt(0)}
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      </div>

      <footer
        className="account-shop__footer shop-rise"
        style={{ '--rise-index': 3 } as CSSProperties}
      >
        <button
          type="button"
          className="account-shop__continue"
          disabled={!selectedCategory}
          onClick={handleContinue}
        >
          ادامه
        </button>
      </footer>
    </div>
  )
}
