import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import Delete02Icon from '../components/icons/delete-02-stroke-rounded'
import SearchIcon from '../components/icons/SearchIcon'
import { useTelegram } from '../hooks/useTelegram'
import { useProductPageView } from '../hooks/useProductPageView'
import { isTelegramWebApp } from '../lib/api'
import { formatTomanPrice } from '../lib/formatStars'
import { getPremiumPrices, searchPremiumRecipient } from '../lib/premium'
import type { StarsRecipient } from '../lib/stars'
import {
  PREMIUM_MONTHS,
  PREMIUM_PLAN_LABELS,
  type PremiumMonths,
  type PremiumPageRestoreState,
  type PremiumPriceQuote,
} from '../types/premium'
import '../styles/shop-rise.css'
import './Premium.css'

const SEARCH_DEBOUNCE_MS = 450
const MIN_USERNAME_LENGTH = 3

function normalizeUsername(value: string): string {
  return value.trim().replace(/^@+/, '')
}

export function PremiumPage() {
  useProductPageView('telegram-premium')
  const navigate = useNavigate()
  const location = useLocation()
  const { haptic, user } = useTelegram()
  const [recipient, setRecipient] = useState('')
  const [foundUser, setFoundUser] = useState<StarsRecipient | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const [prices, setPrices] = useState<PremiumPriceQuote[]>([])
  const [isPricesLoading, setIsPricesLoading] = useState(true)
  const [selectedMonths, setSelectedMonths] = useState<PremiumMonths | null>(null)
  const [isValidatingRecipient, setIsValidatingRecipient] = useState(false)

  const handleBack = useCallback(() => navigate(-1), [navigate])

  useEffect(() => {
    const restored = location.state as PremiumPageRestoreState | null
    if (restored?.recipient) {
      setFoundUser(restored.recipient)
      setRecipient(restored.recipient.username)
      setSearchError(null)
    }
    if (restored?.months) {
      setSelectedMonths(restored.months)
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
    let cancelled = false

    void getPremiumPrices()
      .then((response) => {
        if (!cancelled) {
          setPrices(response.items)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPrices([])
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsPricesLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (foundUser) return

    const username = normalizeUsername(recipient)
    if (username.length < MIN_USERNAME_LENGTH) {
      setIsSearching(false)
      setSearchError(null)
      return
    }

    setIsSearching(true)
    setSearchError(null)

    const timer = window.setTimeout(() => {
      void searchPremiumRecipient(username, 3)
        .then((result) => {
          setFoundUser(result)
          setRecipient(result.username)
          setSearchError(null)
          haptic('light')
        })
        .catch((error: unknown) => {
          setFoundUser(null)
          const raw = error instanceof Error ? error.message : ''
          const lower = raw.toLowerCase()
          if (
            !raw ||
            lower.includes('not found') ||
            lower.includes('404') ||
            lower.includes('recipient')
          ) {
            setSearchError('کاربر پیدا نشد')
            return
          }
          setSearchError(raw)
        })
        .finally(() => {
          setIsSearching(false)
        })
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [foundUser, haptic, recipient])

  const priceByMonths = useMemo(() => {
    const map = new Map<PremiumMonths, PremiumPriceQuote>()
    for (const item of prices) {
      map.set(item.months, item)
    }
    return map
  }, [prices])

  const selectedQuote = selectedMonths ? priceByMonths.get(selectedMonths) ?? null : null

  const canContinue = Boolean(foundUser && selectedQuote && !isValidatingRecipient)

  const handleBuyForMyself = () => {
    haptic('light')
    if (user?.username) {
      setFoundUser(null)
      setSearchError(null)
      setRecipient(user.username)
      return
    }
    if (user?.firstName) {
      setFoundUser(null)
      setSearchError(null)
      setRecipient(user.firstName)
    }
  }

  const handleClearRecipient = () => {
    haptic('light')
    setFoundUser(null)
    setRecipient('')
    setSearchError(null)
    setSelectedMonths(null)
  }

  const handleRecipientChange = (value: string) => {
    if (foundUser) return
    setRecipient(value)
    setSearchError(null)
  }

  const handleSelectPlan = (months: PremiumMonths) => {
    if (!foundUser) return
    haptic('light')
    setSelectedMonths(months)
  }

  const handleContinue = async () => {
    if (!canContinue || !foundUser || !selectedQuote || !selectedMonths) return

    haptic('light')
    setIsValidatingRecipient(true)

    try {
      const validatedRecipient = await searchPremiumRecipient(
        foundUser.username,
        selectedMonths,
      )

      navigate('/premium/confirm', {
        state: {
          recipient: validatedRecipient,
          months: selectedMonths,
          ton: selectedQuote.ton,
          gram: selectedQuote.gram,
          toman: selectedQuote.toman,
        },
      })
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'خطا در تأیید دریافت‌کننده')
    } finally {
      setIsValidatingRecipient(false)
    }
  }

  return (
    <div className="premium">
      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title="تلگرام پریمیوم" onBack={handleBack} />
      </div>

      <div className="premium__body">
        <section
          className="premium__hero shop-rise"
          style={{ '--rise-index': 1 } as CSSProperties}
          aria-label="تلگرام پریمیوم"
        >
          <div className="premium__icon-wrap" aria-hidden>
            <div className="premium__icon-glow" />
            <span className="premium__sparkle premium__sparkle--1" />
            <span className="premium__sparkle premium__sparkle--2" />
            <span className="premium__sparkle premium__sparkle--3" />
            <span className="premium__sparkle premium__sparkle--4" />
            <span className="premium__sparkle premium__sparkle--5" />
            <span className="premium__sparkle premium__sparkle--6" />
            <span className="premium__sparkle premium__sparkle--7" />
            <span className="premium__sparkle premium__sparkle--8" />
            <img
              src="/premium-star.svg"
              alt=""
              className="premium__icon"
              width={90}
              height={90}
            />
          </div>

          <p className="premium__desc">
            اشتراک پریمیوم تلگرام را برای خود یا دیگران تهیه کنید. پس از خرید، اشتراک بلافاصله
            فعال می‌شود.
          </p>
        </section>

        <section
          className="premium__recipient shop-rise"
          style={{ '--rise-index': 2 } as CSSProperties}
          aria-label="انتخاب دریافت‌کننده"
        >
          <div className="premium__recipient-head">
            <h2 className="premium__section-title">انتخاب دریافت‌کننده</h2>
            <button type="button" className="premium__self-btn" onClick={handleBuyForMyself}>
              خرید برای خودم
            </button>
          </div>

          <div
            className={`premium__field${foundUser ? ' premium__field--found' : ''}${
              searchError ? ' premium__field--error' : ''
            }`}
          >
            {foundUser ? (
              <>
                <button
                  type="button"
                  className="premium__clear-btn"
                  onClick={handleClearRecipient}
                  aria-label="پاک کردن دریافت‌کننده"
                >
                  <Delete02Icon width={18} height={18} color="currentColor" />
                </button>
                <div className="premium__found">
                  <span className="premium__found-name">{foundUser.name}</span>
                  <span className="premium__found-avatar">
                    {foundUser.photo ? (
                      <img
                        src={foundUser.photo}
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
                    <span hidden={Boolean(foundUser.photo)}>
                      {foundUser.name.charAt(0)}
                    </span>
                  </span>
                </div>
              </>
            ) : (
              <>
                <span className="premium__field-icon" aria-hidden>
                  {isSearching ? (
                    <span className="premium__spinner" />
                  ) : (
                    <SearchIcon width={18} height={18} color="currentColor" />
                  )}
                </span>
                <input
                  type="text"
                  className="premium__field-input"
                  value={recipient}
                  onChange={(e) => handleRecipientChange(e.target.value)}
                  placeholder="نام کاربری تلگرام را وارد کنید..."
                  dir="rtl"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-label="نام کاربری دریافت‌کننده"
                />
              </>
            )}
          </div>

          {searchError ? (
            <p className="premium__field-error" role="alert">
              {searchError}
            </p>
          ) : null}
        </section>

        <section
          className="premium__plans shop-rise"
          style={{ '--rise-index': 3 } as CSSProperties}
          aria-label="انتخاب مدت اشتراک"
        >
          <h2 className="premium__section-title">انتخاب مدت اشتراک</h2>

          <div className="premium__plans-list" role="radiogroup" aria-label="مدت اشتراک">
            {PREMIUM_MONTHS.map((months) => {
              const quote = priceByMonths.get(months)
              const isSelected = selectedMonths === months
              const isDisabled = !foundUser

              return (
                <button
                  key={months}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  disabled={isDisabled}
                  className={`premium__plan${isSelected ? ' premium__plan--selected' : ''}${
                    isDisabled ? ' premium__plan--disabled' : ''
                  }`}
                  onClick={() => handleSelectPlan(months)}
                >
                  <span className="premium__plan-start">
                    <img
                      src="/premium-star.svg"
                      alt=""
                      className="premium__plan-icon"
                      width={16}
                      height={16}
                    />
                    <span className="premium__plan-label">
                      {PREMIUM_PLAN_LABELS[months]}
                    </span>
                  </span>
                  <span className="premium__plan-price">
                    {isPricesLoading ? (
                      <span className="premium__spinner" />
                    ) : quote ? (
                      <>
                        <span className="premium__plan-price-value">
                          {formatTomanPrice(quote.toman)}
                        </span>
                        <span className="premium__plan-price-unit">تومان</span>
                      </>
                    ) : (
                      '—'
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      </div>

      <footer
        className="premium__footer shop-rise"
        style={{ '--rise-index': 4 } as CSSProperties}
      >
        <button
          type="button"
          className="premium__continue"
          disabled={!canContinue}
          onClick={() => void handleContinue()}
        >
          {isValidatingRecipient ? 'در حال بررسی...' : 'ادامه'}
        </button>
      </footer>
    </div>
  )
}
