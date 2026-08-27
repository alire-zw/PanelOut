import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from './PageHeader'
import { isTelegramWebApp } from '../lib/api'
import '../styles/shop-rise.css'
import './ShopHeroPage.css'

export type ShopHeroTheme =
  | 'virtual-number'
  | 'channel-views'
  | 'reaction'
  | 'telegram-members'
  | 'chatgpt'

export type ShopHeroPageProps = {
  title: string
  ariaLabel: string
  theme: ShopHeroTheme
  stillSrc: string
  animatedSrc: string
}

export function ShopHeroPage({
  title,
  ariaLabel,
  theme,
  stillSrc,
  animatedSrc,
}: ShopHeroPageProps) {
  const navigate = useNavigate()
  const handleBack = useCallback(() => navigate(-1), [navigate])
  const [animatedReady, setAnimatedReady] = useState(false)
  const animatedRef = useRef<HTMLImageElement>(null)

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

  return (
    <div className={`shop-hero-page shop-hero-page--${theme}`}>
      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title={title} onBack={handleBack} />
      </div>

      <div className="shop-hero-page__body">
        <section
          className="shop-hero-page__hero shop-rise"
          style={{ '--rise-index': 1 } as CSSProperties}
          aria-label={ariaLabel}
        >
          <div className="shop-hero-page__image-wrap" aria-hidden>
            <div className="shop-hero-page__image-glow" />
            <img
              src={stillSrc}
              alt=""
              className={`shop-hero-page__image shop-hero-page__image--still${
                animatedReady ? ' shop-hero-page__image--hidden' : ''
              }`}
              width={90}
              height={90}
              fetchPriority="high"
              decoding="async"
            />
            <img
              ref={animatedRef}
              src={animatedSrc}
              alt=""
              className={`shop-hero-page__image shop-hero-page__image--animated${
                animatedReady ? ' shop-hero-page__image--visible' : ''
              }`}
              width={90}
              height={90}
              decoding="async"
              onLoad={() => setAnimatedReady(true)}
            />
          </div>
        </section>
      </div>
    </div>
  )
}
