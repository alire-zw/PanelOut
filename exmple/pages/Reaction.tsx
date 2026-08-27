import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { EmojiGlyph } from '../components/EmojiGlyph'
import { PageHeader } from '../components/PageHeader'
import Delete02Icon from '../components/icons/delete-02-stroke-rounded'
import Link01Icon from '../components/icons/link-01-stroke-rounded'
import { REACTION_SINGLE_EMOJIS } from '../data/reactionEmojis'
import { shopHeroPages } from '../data/shopHeroPages'
import { useTelegram } from '../hooks/useTelegram'
import { useProductPageView } from '../hooks/useProductPageView'
import { usePricedToman } from '../hooks/useShopPricing'
import { isTelegramWebApp } from '../lib/api'
import { fetchReactionPostPreview, type ReactionPostPreview } from '../lib/reaction'
import {
  calcReactionTotalToman,
  type ReactionPageRestoreState,
} from '../types/reaction'
import '../styles/shop-rise.css'
import './Reaction.css'

const heroConfig = shopHeroPages.reaction
const PREVIEW_DEBOUNCE_MS = 450

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

export function ReactionPage() {
  useProductPageView('reaction')
  const navigate = useNavigate()
  const location = useLocation()
  const { haptic } = useTelegram()
  const [postLink, setPostLink] = useState('')
  const [foundPost, setFoundPost] = useState<ReactionPostPreview | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [selectedCounts, setSelectedCounts] = useState<Record<number, number>>({})
  const [animatedReady, setAnimatedReady] = useState(false)
  const animatedRef = useRef<HTMLImageElement>(null)
  const longPressTimerRef = useRef<number | null>(null)
  const suppressClickRef = useRef(false)
  const activePointerIdRef = useRef<number | null>(null)

  const handleBack = useCallback(() => navigate(-1), [navigate])

  useEffect(() => {
    const restored = location.state as ReactionPageRestoreState | null
    if (restored?.post) {
      setFoundPost(restored.post)
      setPostLink(restored.post.link)
      setSearchError(null)
    }
    if (restored?.selectedCounts) {
      setSelectedCounts(restored.selectedCounts)
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
    return () => {
      if (longPressTimerRef.current != null) {
        window.clearTimeout(longPressTimerRef.current)
      }
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

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current != null) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  const decreaseEmoji = (serviceId: number, min: number) => {
    suppressClickRef.current = true
    haptic('medium')
    setSelectedCounts((prev) => {
      const current = prev[serviceId] ?? 0
      if (current <= 0) return prev
      if (current <= min) {
        const next = { ...prev }
        delete next[serviceId]
        return next
      }
      return { ...prev, [serviceId]: current - 1 }
    })
  }

  const increaseEmoji = (serviceId: number, min: number, max: number) => {
    haptic('light')
    setSelectedCounts((prev) => {
      const current = prev[serviceId] ?? 0
      if (current >= max) return prev
      if (current <= 0) {
        return { ...prev, [serviceId]: min }
      }
      return { ...prev, [serviceId]: current + 1 }
    })
  }

  const handleEmojiPointerDown = (
    event: PointerEvent<HTMLButtonElement>,
    serviceId: number,
    min: number,
  ) => {
    if (event.button !== 0) return

    activePointerIdRef.current = event.pointerId
    suppressClickRef.current = false
    clearLongPressTimer()

    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // ignore capture failures
    }

    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null
      decreaseEmoji(serviceId, min)
    }, 420)
  }

  const handleEmojiPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    if (
      activePointerIdRef.current != null &&
      event.pointerId !== activePointerIdRef.current
    ) {
      return
    }

    const wasLongPress = suppressClickRef.current
    clearLongPressTimer()
    activePointerIdRef.current = null

    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    } catch {
      // ignore
    }

    if (wasLongPress) {
      event.preventDefault()
    }
  }

  const handleEmojiPointerCancel = (event: PointerEvent<HTMLButtonElement>) => {
    if (
      activePointerIdRef.current != null &&
      event.pointerId !== activePointerIdRef.current
    ) {
      return
    }

    clearLongPressTimer()
    activePointerIdRef.current = null
  }

  const handleEmojiClick = (serviceId: number, min: number, max: number) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }

    increaseEmoji(serviceId, min, max)
  }

  const selectedReactions = useMemo(
    () =>
      REACTION_SINGLE_EMOJIS.filter((option) => (selectedCounts[option.serviceId] ?? 0) > 0).map(
        (option) => ({
          ...option,
          quantity: selectedCounts[option.serviceId] ?? 0,
        }),
      ),
    [selectedCounts],
  )

  const baseToman = useMemo(
    () => calcReactionTotalToman(selectedReactions),
    [selectedReactions],
  )
  const { toman, ready: pricingReady } = usePricedToman('reaction', baseToman)

  const canContinue =
    Boolean(foundPost) && selectedReactions.length > 0 && pricingReady && toman > 0

  const handleContinue = () => {
    if (!canContinue || !foundPost || toman <= 0) return

    haptic('light')
    navigate('/reaction/confirm', {
      state: {
        post: foundPost,
        reactions: selectedReactions,
        toman,
      },
    })
  }

  return (
    <div className="reaction">
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
                navigate('/reaction/auto')
              }}
            >
              ری‌اکشن خودکار
            </button>
          }
        />
      </div>

      <div className="reaction__body">
        <section
          className="reaction__hero shop-rise"
          style={{ '--rise-index': 1 } as CSSProperties}
          aria-label={heroConfig.ariaLabel}
        >
          <div className="reaction__image-wrap" aria-hidden>
            <div className="reaction__image-glow" />
            <img
              src={heroConfig.stillSrc}
              alt=""
              className={`reaction__image reaction__image--still${
                animatedReady ? ' reaction__image--hidden' : ''
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
              className={`reaction__image reaction__image--animated${
                animatedReady ? ' reaction__image--visible' : ''
              }`}
              width={90}
              height={90}
              decoding="async"
              onLoad={() => setAnimatedReady(true)}
            />
          </div>

          <p className="reaction__desc">
            لینک پست کانال یا گروه تلگرام را وارد کنید تا ری‌اکشن برای آن ارسال شود.
            <span className="reaction__desc-accent">
              {' '}
              حداقل تعداد برای هر ری‌اکشن ۱۰ عدد است.
            </span>
          </p>
        </section>

        <section
          className="reaction__post-link shop-rise"
          style={{ '--rise-index': 2 } as CSSProperties}
          aria-label="لینک پست"
        >
          <div className="reaction__section-head">
            <h2 className="reaction__section-title">لینک پست</h2>
          </div>

          <div
            className={`reaction__field${foundPost ? ' reaction__field--found' : ''}${
              searchError ? ' reaction__field--error' : ''
            }`}
          >
            {foundPost ? (
              <>
                <button
                  type="button"
                  className="reaction__clear-btn"
                  onClick={handleClearPostLink}
                  aria-label="پاک کردن لینک"
                >
                  <Delete02Icon width={18} height={18} color="currentColor" />
                </button>
                <div className="reaction__found">
                  <span className="reaction__found-name">{foundPost.title}</span>
                  {foundPost.preview ? (
                    <>
                      <span className="reaction__found-sep" aria-hidden>
                        |
                      </span>
                      <span className="reaction__found-preview">{foundPost.preview}</span>
                    </>
                  ) : null}
                  <span className="reaction__found-avatar">
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
                <span className="reaction__field-icon" aria-hidden>
                  {isSearching ? (
                    <span className="reaction__spinner" />
                  ) : (
                    <Link01Icon width={18} height={18} />
                  )}
                </span>
                <input
                  type="url"
                  className="reaction__field-input"
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
            <p className="reaction__field-error" role="alert">
              {searchError}
            </p>
          ) : null}
        </section>

        <section
          className="reaction__emojis shop-rise"
          style={{ '--rise-index': 3 } as CSSProperties}
          aria-label="انتخاب ری‌اکشن"
        >
          <div className="reaction__section-head">
            <h2 className="reaction__section-title">انتخاب ری‌اکشن</h2>
            <span className="reaction__section-hint">
              برای افزودن کلیک و برای کسر کردن نگه دارید
            </span>
          </div>

          <div className="reaction__emoji-grid" role="list">
            {REACTION_SINGLE_EMOJIS.map((option) => {
              const count = selectedCounts[option.serviceId] ?? 0
              const isSelected = count > 0

              return (
                <button
                  key={option.serviceId}
                  type="button"
                  role="listitem"
                  className={`reaction__emoji-btn${
                    isSelected ? ' reaction__emoji-btn--selected' : ''
                  }`}
                  onClick={() => handleEmojiClick(option.serviceId, option.min, option.max)}
                  onPointerDown={(event) =>
                    handleEmojiPointerDown(event, option.serviceId, option.min)
                  }
                  onPointerUp={handleEmojiPointerUp}
                  onPointerCancel={handleEmojiPointerCancel}
                  onContextMenu={(event) => event.preventDefault()}
                  aria-label={`${option.emoji}${isSelected ? `، ${count}` : ''}`}
                >
                  <span className="reaction__emoji-glyph" aria-hidden>
                    <EmojiGlyph emoji={option.emoji} size={18} />
                  </span>
                  {isSelected ? (
                    <span className="reaction__emoji-count">
                      {count.toLocaleString('fa-IR')}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </section>
      </div>

      <footer
        className="reaction__footer shop-rise"
        style={{ '--rise-index': 4 } as CSSProperties}
      >
        <button
          type="button"
          className="reaction__continue"
          disabled={!canContinue}
          onClick={handleContinue}
        >
          ادامه
        </button>
      </footer>
    </div>
  )
}
