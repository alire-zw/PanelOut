import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import Delete02Icon from '../components/icons/delete-02-stroke-rounded'
import CursorAddSelection01Icon from '../components/icons/cursor-add-selection-01-stroke-rounded'
import CursorRemoveSelection01Icon from '../components/icons/cursor-remove-selection-01-stroke-rounded'
import Link01Icon from '../components/icons/link-01-stroke-rounded'
import UserIcon from '../components/icons/UserIcon'
import { TelegramMemberServiceStats } from '../components/TelegramMemberServiceStats'
import { TELEGRAM_MEMBER_SERVICES } from '../data/telegramMembers'
import { shopHeroPages } from '../data/shopHeroPages'
import { useTelegram } from '../hooks/useTelegram'
import { useProductPageView } from '../hooks/useProductPageView'
import { usePricedToman } from '../hooks/useShopPricing'
import { isTelegramWebApp } from '../lib/api'
import { fetchTelegramMembersChannelPreview } from '../lib/telegramMembers'
import {
  calcTelegramMembersToman,
  findTelegramMemberService,
  type TelegramMembersChannelPreview,
  type TelegramMembersPageRestoreState,
} from '../types/telegramMembers'
import '../styles/shop-rise.css'
import './TelegramMembers.css'

const heroConfig = shopHeroPages['telegram-members']
const PREVIEW_DEBOUNCE_MS = 450
const QUANTITY_DEBOUNCE_MS = 1500

function formatChannelSubscribers(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''

  // Telegram uses spaces as thousand separators ("203 036 subscribers").
  // In RTL that visually reverses digit groups — parse then format with fa-IR.
  const normalizedDigits = trimmed.replace(/[۰-۹]/g, (digit) =>
    String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)),
  )
  const digitsOnly = normalizedDigits.replace(/[^\d]/g, '')
  if (digitsOnly) {
    const count = Number(digitsOnly)
    if (Number.isFinite(count) && count > 0) {
      return `${count.toLocaleString('fa-IR')} عضو`
    }
  }

  return trimmed
    .replace(/\bsubscribers?\b/gi, 'عضو')
    .replace(/\bmembers?\b/gi, 'عضو')
    .replace(/\bonline\b/gi, 'آنلاین')
}

function looksLikeTelegramChannelLink(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false

  if (trimmed.startsWith('@')) {
    return /^@[a-zA-Z][a-zA-Z0-9_]{3,31}$/.test(trimmed)
  }

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
    if (parts[0]?.toLowerCase() === 'c') return false

    const username = parts[0]?.toLowerCase() === 's' ? parts[1] : parts[0]
    return Boolean(username) && /^[a-zA-Z][a-zA-Z0-9_]{3,31}$/.test(username)
  } catch {
    return false
  }
}

export function TelegramMembersPage() {
  useProductPageView('telegram-members')
  const navigate = useNavigate()
  const location = useLocation()
  const { haptic } = useTelegram()

  const [channelLink, setChannelLink] = useState('')
  const [foundChannel, setFoundChannel] = useState<TelegramMembersChannelPreview | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null)
  const [isTypeOpen, setIsTypeOpen] = useState(false)
  const [quantityInput, setQuantityInput] = useState('')
  const [committedQuantity, setCommittedQuantity] = useState<number | null>(null)
  const [quantityError, setQuantityError] = useState<string | null>(null)
  const [animatedReady, setAnimatedReady] = useState(false)
  const animatedRef = useRef<HTMLImageElement>(null)
  const typeSelectRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const [menuMaxHeight, setMenuMaxHeight] = useState<number | null>(null)

  const selectedService = useMemo(
    () => (selectedServiceId != null ? findTelegramMemberService(selectedServiceId) : undefined),
    [selectedServiceId],
  )

  const handleBack = useCallback(() => navigate(-1), [navigate])

  useEffect(() => {
    const restored = location.state as TelegramMembersPageRestoreState | null
    if (restored?.channel) {
      setFoundChannel(restored.channel)
      setChannelLink(restored.channel.link)
      setSearchError(null)
    }
    if (typeof restored?.serviceId === 'number') {
      setSelectedServiceId(restored.serviceId)
    }
    if (typeof restored?.quantity === 'string') {
      setQuantityInput(restored.quantity)
      setQuantityError(null)
      const restoredQty = Number.parseInt(restored.quantity, 10)
      const service =
        typeof restored.serviceId === 'number'
          ? findTelegramMemberService(restored.serviceId)
          : undefined
      if (
        service &&
        Number.isFinite(restoredQty) &&
        restoredQty >= service.min &&
        restoredQty <= service.max
      ) {
        setCommittedQuantity(restoredQty)
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
    if (!isTypeOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!typeSelectRef.current?.contains(event.target as Node)) {
        setIsTypeOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [isTypeOpen])

  useLayoutEffect(() => {
    if (!isTypeOpen) {
      setMenuMaxHeight(null)
      return
    }

    const body = bodyRef.current
    const select = typeSelectRef.current
    if (!body || !select) return

    const bodyRect = body.getBoundingClientRect()
    const selectRect = select.getBoundingClientRect()
    body.scrollTop += selectRect.top - bodyRect.top - 8

    const measureMenu = () => {
      const trigger = select.querySelector('.telegram-members__select-trigger')
      const footer = document.querySelector('.telegram-members__footer')
      if (!(trigger instanceof HTMLElement)) return

      const bottomLimit =
        footer instanceof HTMLElement
          ? footer.getBoundingClientRect().top
          : window.innerHeight
      const space = bottomLimit - trigger.getBoundingClientRect().bottom - 10
      setMenuMaxHeight(Math.max(160, Math.min(420, space)))
    }

    const raf = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(measureMenu)
    })

    window.addEventListener('resize', measureMenu)
    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener('resize', measureMenu)
    }
  }, [isTypeOpen])

  useEffect(() => {
    if (foundChannel) return

    const link = channelLink.trim()
    if (!looksLikeTelegramChannelLink(link)) {
      setIsSearching(false)
      setSearchError(null)
      return
    }

    setIsSearching(true)
    setSearchError(null)

    const timer = window.setTimeout(() => {
      void fetchTelegramMembersChannelPreview(link)
        .then((result) => {
          setFoundChannel(result)
          setChannelLink(result.link)
          setSearchError(null)
          haptic('light')
        })
        .catch((error: unknown) => {
          setFoundChannel(null)
          setSearchError(error instanceof Error ? error.message : 'کانال پیدا نشد')
        })
        .finally(() => {
          setIsSearching(false)
        })
    }, PREVIEW_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [channelLink, foundChannel, haptic])

  useEffect(() => {
    if (!selectedService) {
      setCommittedQuantity(null)
      setQuantityError(null)
      return
    }

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

      if (numValue < selectedService.min) {
        setCommittedQuantity(null)
        setQuantityError(
          `حداقل تعداد ممبر ${selectedService.min.toLocaleString('fa-IR')} است`,
        )
        return
      }

      if (numValue > selectedService.max) {
        setCommittedQuantity(null)
        setQuantityError(
          `حداکثر تعداد ممبر ${selectedService.max.toLocaleString('fa-IR')} است`,
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
  }, [haptic, quantityInput, selectedService])

  const handleChannelLinkChange = (value: string) => {
    setFoundChannel(null)
    setSearchError(null)
    setChannelLink(value)
  }

  const handleClearChannel = () => {
    haptic('light')
    setFoundChannel(null)
    setSearchError(null)
    setChannelLink('')
    setIsSearching(false)
  }

  const handleSelectService = (serviceId: number) => {
    haptic('light')
    setSelectedServiceId(serviceId)
    setIsTypeOpen(false)
    setQuantityInput('')
    setCommittedQuantity(null)
    setQuantityError(null)
  }

  const quantity = committedQuantity ?? 0
  const baseToman = useMemo(() => {
    if (!selectedService || !committedQuantity) return 0
    return calcTelegramMembersToman(committedQuantity, selectedService.rate)
  }, [committedQuantity, selectedService])
  const { toman, ready: pricingReady } = usePricedToman('telegram-members', baseToman)

  const quantityConfirmed = committedQuantity != null && Boolean(selectedService)
  const canContinue =
    Boolean(foundChannel) &&
    Boolean(selectedService) &&
    quantityConfirmed &&
    pricingReady &&
    toman > 0

  const handleContinue = () => {
    if (!canContinue || !foundChannel || !selectedService || committedQuantity == null) return

    haptic('light')
    navigate('/telegram-members/confirm', {
      state: {
        channel: foundChannel,
        service: selectedService,
        quantity: committedQuantity,
        toman,
      },
    })
  }

  return (
    <div className="telegram-members">
      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title={heroConfig.title} onBack={handleBack} />
      </div>

      <div
        ref={bodyRef}
        className={`telegram-members__body${isTypeOpen ? ' telegram-members__body--select-open' : ''}`}
      >
        <section
          className="telegram-members__hero shop-rise"
          style={{ '--rise-index': 1 } as CSSProperties}
          aria-label={heroConfig.ariaLabel}
        >
          <div className="telegram-members__image-wrap" aria-hidden>
            <div className="telegram-members__image-glow" />
            <img
              src={heroConfig.stillSrc}
              alt=""
              className={`telegram-members__image telegram-members__image--still${
                animatedReady ? ' telegram-members__image--hidden' : ''
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
              className={`telegram-members__image telegram-members__image--animated${
                animatedReady ? ' telegram-members__image--visible' : ''
              }`}
              width={90}
              height={90}
              decoding="async"
              onLoad={() => setAnimatedReady(true)}
            />
          </div>

          <p className="telegram-members__desc">
            لینک کانال عمومی تلگرام را وارد کنید، نوع ممبر را انتخاب کنید و تعداد را مشخص نمایید.
            <span className="telegram-members__desc-accent"> فقط کانال‌های عمومی پشتیبانی می‌شوند.</span>
          </p>
        </section>

        <section
          className="telegram-members__channel-link shop-rise"
          style={{ '--rise-index': 2 } as CSSProperties}
          aria-label="لینک کانال"
        >
          <div className="telegram-members__section-head">
            <h2 className="telegram-members__section-title">لینک کانال</h2>
          </div>

          <div
            className={`telegram-members__field${foundChannel ? ' telegram-members__field--found' : ''}${
              searchError ? ' telegram-members__field--error' : ''
            }`}
          >
            {foundChannel ? (
              <>
                <button
                  type="button"
                  className="telegram-members__clear-btn"
                  onClick={handleClearChannel}
                  aria-label="پاک کردن لینک"
                >
                  <Delete02Icon width={18} height={18} color="currentColor" />
                </button>
                <div className="telegram-members__found">
                  <span className="telegram-members__found-name">{foundChannel.title}</span>
                  {foundChannel.subscribers ? (
                    <>
                      <span className="telegram-members__found-sep" aria-hidden>
                        |
                      </span>
                      <span className="telegram-members__found-preview">
                        {formatChannelSubscribers(foundChannel.subscribers)}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="telegram-members__found-sep" aria-hidden>
                        |
                      </span>
                      <span className="telegram-members__found-preview" dir="ltr">
                        @{foundChannel.username}
                      </span>
                    </>
                  )}
                  <span className="telegram-members__found-avatar">
                    {foundChannel.photo ? (
                      <img
                        src={foundChannel.photo}
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
                    <span hidden={Boolean(foundChannel.photo)}>
                      {foundChannel.title.charAt(0)}
                    </span>
                  </span>
                </div>
              </>
            ) : (
              <>
                <span className="telegram-members__field-icon" aria-hidden>
                  {isSearching ? (
                    <span className="telegram-members__spinner" />
                  ) : (
                    <Link01Icon width={18} height={18} />
                  )}
                </span>
                <input
                  type="url"
                  className="telegram-members__field-input"
                  value={channelLink}
                  onChange={(e) => handleChannelLinkChange(e.target.value)}
                  placeholder="لینک کانال را وارد کنید..."
                  dir="ltr"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  inputMode="url"
                  aria-label="لینک کانال"
                />
              </>
            )}
          </div>

          {searchError ? (
            <p className="telegram-members__field-error" role="alert">
              {searchError}
            </p>
          ) : null}
        </section>

        <section
          className={`telegram-members__types shop-rise${
            isTypeOpen ? ' telegram-members__types--open' : ''
          }`}
          style={{ '--rise-index': 3 } as CSSProperties}
          aria-label="نوع ممبر"
        >
          <div className="telegram-members__section-head">
            <h2 className="telegram-members__section-title">نوع ممبر</h2>
          </div>

          <div className="telegram-members__select" ref={typeSelectRef}>
            <button
              type="button"
              className={`telegram-members__select-trigger${
                selectedService ? ' telegram-members__select-trigger--selected' : ' telegram-members__select-trigger--empty'
              }${isTypeOpen ? ' telegram-members__select-trigger--open' : ''}`}
              aria-haspopup="listbox"
              aria-expanded={isTypeOpen}
              onClick={() => {
                haptic('light')
                setIsTypeOpen((prev) => !prev)
              }}
            >
              {selectedService ? (
                <>
                  <span className="telegram-members__select-top">
                    <span className="telegram-members__select-content">
                      <span className="telegram-members__select-title">{selectedService.name}</span>
                      <span className="telegram-members__select-subtitle">
                        {selectedService.shortDesc}
                      </span>
                    </span>
                    <span className="telegram-members__select-icon" aria-hidden>
                      <span
                        className={`telegram-members__select-icon-layer${
                          !isTypeOpen ? ' telegram-members__select-icon-layer--active' : ''
                        }`}
                      >
                        <CursorAddSelection01Icon width={20} height={20} />
                      </span>
                      <span
                        className={`telegram-members__select-icon-layer${
                          isTypeOpen ? ' telegram-members__select-icon-layer--active' : ''
                        }`}
                      >
                        <CursorRemoveSelection01Icon width={20} height={20} />
                      </span>
                    </span>
                  </span>
                  <TelegramMemberServiceStats
                    rate={selectedService.rate}
                    min={selectedService.min}
                    max={selectedService.max}
                    compact
                  />
                </>
              ) : (
                <>
                  <span className="telegram-members__select-content">
                    <span className="telegram-members__select-placeholder">
                      نوع ممبر را انتخاب کنید
                    </span>
                    <span className="telegram-members__select-placeholder-hint">
                      قیمت، حداقل سفارش و جزئیات هر سرویس
                    </span>
                  </span>
                  <span className="telegram-members__select-icon" aria-hidden>
                    <span
                      className={`telegram-members__select-icon-layer${
                        !isTypeOpen ? ' telegram-members__select-icon-layer--active' : ''
                      }`}
                    >
                      <CursorAddSelection01Icon width={20} height={20} />
                    </span>
                    <span
                      className={`telegram-members__select-icon-layer${
                        isTypeOpen ? ' telegram-members__select-icon-layer--active' : ''
                      }`}
                    >
                      <CursorRemoveSelection01Icon width={20} height={20} />
                    </span>
                  </span>
                </>
              )}
            </button>

            {isTypeOpen ? (
              <div
                className="telegram-members__select-menu"
                role="listbox"
                aria-label="لیست نوع ممبر"
                style={menuMaxHeight != null ? { maxHeight: menuMaxHeight } : undefined}
              >
                {TELEGRAM_MEMBER_SERVICES.map((service) => {
                  const isSelected = selectedServiceId === service.serviceId

                  return (
                    <button
                      key={service.serviceId}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={`telegram-members__select-option${
                        isSelected ? ' telegram-members__select-option--selected' : ''
                      }`}
                      onClick={() => handleSelectService(service.serviceId)}
                    >
                      <span className="telegram-members__select-option-main">
                        <span className="telegram-members__select-option-name">{service.name}</span>
                        <span className="telegram-members__select-option-desc">
                          {service.shortDesc}
                        </span>
                        <TelegramMemberServiceStats
                          rate={service.rate}
                          min={service.min}
                          max={service.max}
                        />
                      </span>
                    </button>
                  )
                })}
              </div>
            ) : null}
          </div>
        </section>

        {selectedService ? (
          <section
            className="telegram-members__quantity shop-rise"
            style={{ '--rise-index': 4 } as CSSProperties}
            aria-label="تعداد ممبر"
          >
            <div className="telegram-members__section-head">
              <h2 className="telegram-members__section-title">تعداد ممبر</h2>
              <span className="telegram-members__section-hint">
                از {selectedService.min.toLocaleString('fa-IR')} تا{' '}
                {selectedService.max.toLocaleString('fa-IR')}
              </span>
            </div>

            <div
              className={`telegram-members__field telegram-members__field--quantity${
                quantityConfirmed ? ' telegram-members__field--found' : ''
              }${quantityError ? ' telegram-members__field--error' : ''}`}
            >
              {quantityConfirmed ? (
                <>
                  <button
                    type="button"
                    className="telegram-members__clear-btn"
                    onClick={() => {
                      haptic('light')
                      setQuantityInput('')
                      setCommittedQuantity(null)
                      setQuantityError(null)
                    }}
                    aria-label="پاک کردن تعداد"
                  >
                    <Delete02Icon width={18} height={18} color="currentColor" />
                  </button>
                  <div className="telegram-members__quantity-summary">
                    <div className="telegram-members__quantity-count">
                      {quantity.toLocaleString('fa-IR')} ممبر
                    </div>
                    <div className="telegram-members__quantity-price">
                      <span className="telegram-members__quantity-price-value">
                        {toman.toLocaleString('fa-IR')}
                      </span>
                      <span className="telegram-members__quantity-price-unit">تومان</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <span className="telegram-members__field-icon" aria-hidden>
                    <UserIcon width={18} height={18} />
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="telegram-members__field-input telegram-members__field-input--quantity"
                    value={quantityInput}
                    onChange={(e) => {
                      const value = e.target.value
                      if (!/^[0-9]*$/.test(value)) return
                      setQuantityInput(value)
                      setCommittedQuantity(null)
                      setQuantityError(null)
                    }}
                    placeholder="تعداد ممبر را وارد کنید..."
                    autoComplete="off"
                    spellCheck={false}
                    aria-label="تعداد ممبر"
                  />
                </>
              )}
            </div>

            {quantityError ? (
              <p className="telegram-members__field-error" role="alert">
                {quantityError}
              </p>
            ) : null}
          </section>
        ) : null}
      </div>

      <footer
        className="telegram-members__footer shop-rise"
        style={{ '--rise-index': 5 } as CSSProperties}
      >
        <button
          type="button"
          className="telegram-members__continue"
          disabled={!canContinue}
          onClick={handleContinue}
        >
          ادامه
        </button>
      </footer>
    </div>
  )
}
