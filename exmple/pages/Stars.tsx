import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import Delete02Icon from '../components/icons/delete-02-stroke-rounded'
import SearchIcon from '../components/icons/SearchIcon'
import { useTelegram } from '../hooks/useTelegram'
import { useProductPageView } from '../hooks/useProductPageView'
import { isTelegramWebApp } from '../lib/api'
import { formatTomanPrice } from '../lib/formatStars'
import { getStarsPrice, searchStarsRecipient, type StarsRecipient } from '../lib/stars'
import type { StarsPageRestoreState } from '../types/stars'
import '../styles/shop-rise.css'
import './Stars.css'

const SEARCH_DEBOUNCE_MS = 450
const PRICE_DEBOUNCE_MS = 450
const MIN_USERNAME_LENGTH = 3
const MIN_STARS = 50
const MAX_STARS = 1_000_000

function normalizeUsername(value: string): string {
  return value.trim().replace(/^@+/, '')
}

type QuantityPrice = {
  stars: number
  ton: number
  gram: number
  toman: number
}

export function StarsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { haptic, user } = useTelegram()
  useProductPageView('telegram-stars')
  const [recipient, setRecipient] = useState('')
  const [foundUser, setFoundUser] = useState<StarsRecipient | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const [customAmount, setCustomAmount] = useState('')
  const [priceData, setPriceData] = useState<QuantityPrice | null>(null)
  const [isPriceLoading, setIsPriceLoading] = useState(false)
  const [amountError, setAmountError] = useState<string | null>(null)

  const handleBack = useCallback(() => navigate(-1), [navigate])

  useEffect(() => {
    const restored = location.state as StarsPageRestoreState | null
    if (restored?.recipient) {
      setFoundUser(restored.recipient)
      setRecipient(restored.recipient.username)
      setSearchError(null)
    }
    if (restored?.customAmount) {
      setCustomAmount(restored.customAmount)
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
      void searchStarsRecipient(username)
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

  useEffect(() => {
    const stars = Number.parseInt(customAmount, 10)
    if (!customAmount || Number.isNaN(stars) || stars < MIN_STARS || stars > MAX_STARS) {
      setPriceData(null)
      setIsPriceLoading(false)
      return
    }

    setIsPriceLoading(true)

    const timer = window.setTimeout(() => {
      void getStarsPrice(stars)
        .then((price) => {
          setPriceData({
            stars,
            ton: price.ton,
            gram: price.gram,
            toman: price.toman,
          })
        })
        .catch(() => {
          setPriceData(null)
        })
        .finally(() => {
          setIsPriceLoading(false)
        })
    }, PRICE_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [customAmount])

  const canContinue = useMemo(() => {
    if (!foundUser || !priceData || isPriceLoading || amountError) {
      return false
    }

    return (
      priceData.stars >= MIN_STARS &&
      priceData.stars <= MAX_STARS &&
      priceData.toman > 0
    )
  }, [amountError, foundUser, isPriceLoading, priceData])

  const handleContinue = () => {
    if (!canContinue || !foundUser || !priceData) return

    haptic('light')
    navigate('/stars/confirm', {
      state: {
        recipient: foundUser,
        stars: priceData.stars,
        ton: priceData.ton,
        gram: priceData.gram,
        toman: priceData.toman,
      },
    })
  }

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
  }

  const handleRecipientChange = (value: string) => {
    if (foundUser) return
    setRecipient(value)
    setSearchError(null)
  }

  const handleCustomAmountChange = (value: string) => {
    if (!/^[0-9]*$/.test(value)) return

    setCustomAmount(value)

    const numValue = Number.parseInt(value, 10)
    if (value && (numValue < MIN_STARS || numValue > MAX_STARS)) {
      if (numValue < MIN_STARS) {
        setAmountError('حداقل تعداد استارز 50 است')
      } else {
        setAmountError('حداکثر تعداد استارز 1,000,000 است')
      }
    } else {
      setAmountError(null)
    }

    if (!value.trim()) {
      setPriceData(null)
      setAmountError(null)
    }
  }

  const handleClearQuantity = () => {
    haptic('light')
    setPriceData(null)
    setCustomAmount('')
    setAmountError(null)
  }

  return (
    <div className="stars">
      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title="تلگرام استارز" onBack={handleBack} />
      </div>

      <div className="stars__body">
        <section
          className="stars__hero shop-rise"
          style={{ '--rise-index': 1 } as CSSProperties}
          aria-label="استارز تلگرام"
        >
          <div className="stars__icon-wrap" aria-hidden>
            <div className="stars__icon-glow" />
            <span className="stars__sparkle stars__sparkle--1" />
            <span className="stars__sparkle stars__sparkle--2" />
            <span className="stars__sparkle stars__sparkle--3" />
            <span className="stars__sparkle stars__sparkle--4" />
            <span className="stars__sparkle stars__sparkle--5" />
            <span className="stars__sparkle stars__sparkle--6" />
            <span className="stars__sparkle stars__sparkle--7" />
            <span className="stars__sparkle stars__sparkle--8" />
            <img src="/star.svg" alt="" className="stars__icon" width={90} height={90} />
          </div>

          <p className="stars__desc">
            استارز تلگرام برای ارسال هدیه و پشتیبانی از کانال‌ها و ربات‌هاست. پس از خرید، استارز
            بلافاصله واریز می‌شود.
          </p>
        </section>

        <section
          className="stars__recipient shop-rise"
          style={{ '--rise-index': 2 } as CSSProperties}
          aria-label="انتخاب دریافت‌کننده"
        >
          <div className="stars__recipient-head">
            <h2 className="stars__section-title">انتخاب دریافت‌کننده</h2>
            <button type="button" className="stars__self-btn" onClick={handleBuyForMyself}>
              خرید برای خودم
            </button>
          </div>

          <div
            className={`stars__field${foundUser ? ' stars__field--found' : ''}${
              searchError ? ' stars__field--error' : ''
            }`}
          >
            {foundUser ? (
              <>
                <button
                  type="button"
                  className="stars__clear-btn"
                  onClick={handleClearRecipient}
                  aria-label="پاک کردن دریافت‌کننده"
                >
                  <Delete02Icon width={18} height={18} color="currentColor" />
                </button>
                <div className="stars__found">
                  <span className="stars__found-name">{foundUser.name}</span>
                  <span className="stars__found-avatar">
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
                <span className="stars__field-icon" aria-hidden>
                  {isSearching ? (
                    <span className="stars__spinner" />
                  ) : (
                    <SearchIcon width={18} height={18} color="currentColor" />
                  )}
                </span>
                <input
                  type="text"
                  className="stars__field-input"
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
            <p className="stars__field-error" role="alert">
              {searchError}
            </p>
          ) : null}
        </section>

        <section
          className="stars__quantity shop-rise"
          style={{ '--rise-index': 3 } as CSSProperties}
          aria-label="انتخاب مقدار استارز"
        >
          <div className="stars__recipient-head">
            <h2 className="stars__section-title">انتخاب مقدار استارز</h2>
            {amountError ? (
              <span className="stars__amount-error" role="alert">
                {amountError}
              </span>
            ) : null}
          </div>

          <div
            className={`stars__field stars__field--quantity${
              priceData ? ' stars__field--found' : ''
            }`}
          >
            {priceData ? (
              <>
                <button
                  type="button"
                  className="stars__clear-btn"
                  onClick={handleClearQuantity}
                  aria-label="پاک کردن مقدار"
                >
                  <Delete02Icon width={18} height={18} color="currentColor" />
                </button>
                <div className="stars__quantity-summary">
                  <div className="stars__quantity-stars">
                    <img src="/star.svg" alt="" className="stars__mini-star" width={16} height={16} />
                    <span>{priceData.stars.toLocaleString('fa-IR')} استارز</span>
                  </div>
                  <div className="stars__quantity-price">
                    <span className="stars__quantity-price-value">
                      {formatTomanPrice(priceData.toman)}
                    </span>
                    <span className="stars__quantity-price-unit">تومان</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <span className="stars__field-icon" aria-hidden>
                  {isPriceLoading ? (
                    <span className="stars__spinner" />
                  ) : (
                    <img src="/star.svg" alt="" className="stars__mini-star" width={18} height={18} />
                  )}
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  className="stars__field-input"
                  value={customAmount}
                  onChange={(e) => handleCustomAmountChange(e.target.value)}
                  placeholder="مقدار را از ۵۰ تا ۱,۰۰۰,۰۰۰ وارد کنید"
                  dir="rtl"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-label="مقدار استارز"
                />
              </>
            )}
          </div>
        </section>
      </div>

      <footer
        className="stars__footer shop-rise"
        style={{ '--rise-index': 4 } as CSSProperties}
      >
        <button
          type="button"
          className="stars__continue"
          disabled={!canContinue}
          onClick={handleContinue}
        >
          ادامه
        </button>
      </footer>
    </div>
  )
}
