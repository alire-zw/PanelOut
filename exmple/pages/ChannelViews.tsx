import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import Delete02Icon from '../components/icons/delete-02-stroke-rounded'
import Link01Icon from '../components/icons/link-01-stroke-rounded'
import ViewIcon from '../components/icons/ViewIcon'
import { CHANNEL_VIEW_SERVICE } from '../data/channelViews'
import { shopHeroPages } from '../data/shopHeroPages'
import { useTelegram } from '../hooks/useTelegram'
import { useProductPageView } from '../hooks/useProductPageView'
import { usePricedToman } from '../hooks/useShopPricing'
import { isTelegramWebApp } from '../lib/api'
import { fetchReactionPostPreview, type ReactionPostPreview } from '../lib/reaction'
import {
  calcChannelViewsToman,
  type ChannelViewsPageRestoreState,
} from '../types/channelViews'
import '../styles/shop-rise.css'
import './ChannelViews.css'

const heroConfig = shopHeroPages['channel-views']
const PREVIEW_DEBOUNCE_MS = 450
const QUANTITY_DEBOUNCE_MS = 1500

function looksLikeTelegramPostLink(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false

  const normalized = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed.replace(/^\/+/, '')}`

  try {
    const url = new URL(normalized)
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    if (host !== 't.me' && host !== 'telegram.me' && host !== 'telegram.dog') {
      return false
    }

    const parts = url.pathname.split('/').filter(Boolean)
    const usernameIndex = parts[0]?.toLowerCase() === 's' ? 1 : 0
    const username = parts[usernameIndex]
    const messageId = Number.parseInt(parts[usernameIndex + 1] ?? '', 10)
    return Boolean(username) && Number.isFinite(messageId) && messageId > 0
  } catch {
    return false
  }
}

export function ChannelViewsPage() {
  useProductPageView('channel-views')
  const navigate = useNavigate()
  const location = useLocation()
  const { haptic } = useTelegram()
  const [postLink, setPostLink] = useState('')
  const [foundPost, setFoundPost] = useState<ReactionPostPreview | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [quantityInput, setQuantityInput] = useState('')
  const [committedQuantity, setCommittedQuantity] = useState<number | null>(null)
  const [quantityError, setQuantityError] = useState<string | null>(null)
  const [animatedReady, setAnimatedReady] = useState(false)
  const animatedRef = useRef<HTMLImageElement>(null)

  const handleBack = useCallback(() => navigate(-1), [navigate])

  useEffect(() => {
    const restored = location.state as ChannelViewsPageRestoreState | null
    if (restored?.post) {
      setFoundPost(restored.post)
      setPostLink(restored.post.link)
      setSearchError(null)
    }
    if (typeof restored?.quantity === 'string') {
      setQuantityInput(restored.quantity)
      setQuantityError(null)
      const restoredQty = Number.parseInt(restored.quantity, 10)
      if (
        Number.isFinite(restoredQty) &&
        restoredQty >= CHANNEL_VIEW_SERVICE.min &&
        restoredQty <= CHANNEL_VIEW_SERVICE.max
      ) {
        setCommittedQuantity(restoredQty)
      } else {
        setCommittedQuantity(null)
      }
    }
  }, [location.key, location.state])

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

  useEffect(() => {
    if (foundPost) return

    const link = postLink.trim()
    if (!looksLikeTelegramPostLink(link)) {
      setIsSearching(false)
      setSearchError(null)
      return
    }

    setIsSearching(true)
    setSearchError(null)

    const timer = window.setTimeout(() => {
      void fetchReactionPostPreview(link)
        .then((result) => {
          setFoundPost(result)
          setPostLink(result.link)
          setSearchError(null)
          haptic('light')
        })
        .catch((error: unknown) => {
          setFoundPost(null)
          setSearchError(error instanceof Error ? error.message : 'پست پیدا نشد')
        })
        .finally(() => {
          setIsSearching(false)
        })
    }, PREVIEW_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [foundPost, haptic, postLink])

  const handlePostLinkChange = (value: string) => {
    setFoundPost(null)
    setSearchError(null)
    setPostLink(value)
  }

  const handleClearPostLink = () => {
    haptic('light')
    setFoundPost(null)
    setSearchError(null)
    setPostLink('')
    setIsSearching(false)
  }

  const handleQuantityChange = (value: string) => {
    if (!/^[0-9]*$/.test(value)) return

    setQuantityInput(value)
    setCommittedQuantity(null)
    setQuantityError(null)
  }

  const handleClearQuantity = () => {
    haptic('light')
    setQuantityInput('')
    setCommittedQuantity(null)
    setQuantityError(null)
  }

  useEffect(() => {
    if (!quantityInput.trim()) {
      setCommittedQuantity(null)
      setQuantityError(null)
      return
    }

    const timer = window.setTimeout(() => {
      const numValue = Number.parseInt(quantityInput, 10)
      if (!Number.isFinite(numValue)) {
        setCommittedQuantity(null)
        setQuantityError(null)
        return
      }

      if (numValue < CHANNEL_VIEW_SERVICE.min) {
        setCommittedQuantity(null)
        setQuantityError(
          `حداقل تعداد بازدید ${CHANNEL_VIEW_SERVICE.min.toLocaleString('fa-IR')} است`,
        )
        return
      }

      if (numValue > CHANNEL_VIEW_SERVICE.max) {
        setCommittedQuantity(null)
        setQuantityError(
          `حداکثر تعداد بازدید ${CHANNEL_VIEW_SERVICE.max.toLocaleString('fa-IR')} است`,
        )
        return
      }

      setQuantityError(null)
      setCommittedQuantity(numValue)
      haptic('light')
    }, QUANTITY_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [haptic, quantityInput])

  const quantity = committedQuantity ?? 0

  const baseToman = useMemo(
    () => calcChannelViewsToman(quantity, CHANNEL_VIEW_SERVICE.rate),
    [quantity],
  )
  const { toman, ready: pricingReady } = usePricedToman('channel-views', baseToman)

  const quantityConfirmed = committedQuantity != null

  const canContinue =
    Boolean(foundPost) && quantityConfirmed && pricingReady && toman > 0

  const handleContinue = () => {
    if (!canContinue || !foundPost || committedQuantity == null) return

    haptic('light')
    navigate('/channel-views/confirm', {
      state: {
        post: foundPost,
        quantity: committedQuantity,
        rate: CHANNEL_VIEW_SERVICE.rate,
        serviceId: CHANNEL_VIEW_SERVICE.serviceId,
        toman,
      },
    })
  }

  return (
    <div className="channel-views">
      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader
          title={heroConfig.title}
          onBack={handleBack}
          action={
            <button
              type="button"
              className="page-header__action"
              onClick={() => {
                haptic('light')
                navigate('/channel-views/auto')
              }}
            >
              سین خودکار
            </button>
          }
        />
      </div>

      <div className="channel-views__body">
        <section
          className="channel-views__hero shop-rise"
          style={{ '--rise-index': 1 } as CSSProperties}
          aria-label={heroConfig.ariaLabel}
        >
          <div className="channel-views__image-wrap" aria-hidden>
            <div className="channel-views__image-glow" />
            <img
              src={heroConfig.stillSrc}
              alt=""
              className={`channel-views__image channel-views__image--still${
                animatedReady ? ' channel-views__image--hidden' : ''
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
              className={`channel-views__image channel-views__image--animated${
                animatedReady ? ' channel-views__image--visible' : ''
              }`}
              width={90}
              height={90}
              decoding="async"
              onLoad={() => setAnimatedReady(true)}
            />
          </div>

          <p className="channel-views__desc">
            لینک پست کانال تلگرام را وارد کنید تا بازدید برای آن ثبت شود.
            <span className="channel-views__desc-accent">
              {' '}
              حداقل تعداد بازدید {CHANNEL_VIEW_SERVICE.min.toLocaleString('fa-IR')} است.
            </span>
          </p>
        </section>

        <section
          className="channel-views__post-link shop-rise"
          style={{ '--rise-index': 2 } as CSSProperties}
          aria-label="لینک پست"
        >
          <div className="channel-views__section-head">
            <h2 className="channel-views__section-title">لینک پست</h2>
          </div>

          <div
            className={`channel-views__field${foundPost ? ' channel-views__field--found' : ''}${
              searchError ? ' channel-views__field--error' : ''
            }`}
          >
            {foundPost ? (
              <>
                <button
                  type="button"
                  className="channel-views__clear-btn"
                  onClick={handleClearPostLink}
                  aria-label="پاک کردن لینک"
                >
                  <Delete02Icon width={18} height={18} color="currentColor" />
                </button>
                <div className="channel-views__found">
                  <span className="channel-views__found-name">{foundPost.title}</span>
                  {foundPost.preview ? (
                    <>
                      <span className="channel-views__found-sep" aria-hidden>
                        |
                      </span>
                      <span className="channel-views__found-preview">{foundPost.preview}</span>
                    </>
                  ) : null}
                  <span className="channel-views__found-avatar">
                    {foundPost.photo ? (
                      <img
                        src={foundPost.photo}
                        alt=""
                        onError={(event) => {
                          event.currentTarget.style.display = 'none'
                          const fallback = event.currentTarget.nextElementSibling
                          if (fallback instanceof HTMLElement) {
                            fallback.hidden = false
                          }
                        }}
                      />
                    ) : null}
                    <span hidden={Boolean(foundPost.photo)}>
                      {foundPost.title.charAt(0)}
                    </span>
                  </span>
                </div>
              </>
            ) : (
              <>
                <span className="channel-views__field-icon" aria-hidden>
                  {isSearching ? (
                    <span className="channel-views__spinner" />
                  ) : (
                    <Link01Icon width={18} height={18} />
                  )}
                </span>
                <input
                  type="url"
                  className="channel-views__field-input"
                  value={postLink}
                  onChange={(e) => handlePostLinkChange(e.target.value)}
                  placeholder="لینک پست را وارد کنید..."
                  dir="ltr"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  inputMode="url"
                  aria-label="لینک پست"
                />
              </>
            )}
          </div>

          {searchError ? (
            <p className="channel-views__field-error" role="alert">
              {searchError}
            </p>
          ) : null}
        </section>

        <section
          className="channel-views__quantity shop-rise"
          style={{ '--rise-index': 3 } as CSSProperties}
          aria-label="تعداد بازدید"
        >
          <div className="channel-views__section-head">
            <h2 className="channel-views__section-title">تعداد بازدید</h2>
            <span className="channel-views__section-hint">
              از {CHANNEL_VIEW_SERVICE.min.toLocaleString('fa-IR')} تا{' '}
              {CHANNEL_VIEW_SERVICE.max.toLocaleString('fa-IR')}
            </span>
          </div>

          <div
            className={`channel-views__field channel-views__field--quantity${
              quantityConfirmed ? ' channel-views__field--found' : ''
            }${quantityError ? ' channel-views__field--error' : ''}`}
          >
            {quantityConfirmed ? (
              <>
                <button
                  type="button"
                  className="channel-views__clear-btn"
                  onClick={handleClearQuantity}
                  aria-label="پاک کردن تعداد"
                >
                  <Delete02Icon width={18} height={18} color="currentColor" />
                </button>
                <div className="channel-views__quantity-summary">
                  <div className="channel-views__quantity-count">
                    {quantity.toLocaleString('fa-IR')} بازدید
                  </div>
                  <div className="channel-views__quantity-price">
                    <span className="channel-views__quantity-price-value">
                      {toman.toLocaleString('fa-IR')}
                    </span>
                    <span className="channel-views__quantity-price-unit">تومان</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <span className="channel-views__field-icon" aria-hidden>
                  <ViewIcon width={18} height={18} />
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  className="channel-views__field-input channel-views__field-input--quantity"
                  value={quantityInput}
                  onChange={(e) => handleQuantityChange(e.target.value)}
                  placeholder="تعداد بازدید را وارد کنید..."
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-label="تعداد بازدید"
                />
              </>
            )}
          </div>

          {quantityError ? (
            <p className="channel-views__field-error" role="alert">
              {quantityError}
            </p>
          ) : null}
        </section>
      </div>

      <footer
        className="channel-views__footer shop-rise"
        style={{ '--rise-index': 4 } as CSSProperties}
      >
        <button
          type="button"
          className="channel-views__continue"
          disabled={!canContinue}
          onClick={handleContinue}
        >
          ادامه
        </button>
      </footer>
    </div>
  )
}
