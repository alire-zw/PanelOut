import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CountryFlagImg } from '../components/CountryFlagImg'
import { CenterModal } from '../components/CenterModal'
import { Notification } from '../components/Notification'
import { PageHeader } from '../components/PageHeader'
import CopyIcon from '../components/icons/CopyIcon'
import BinaryCodeIcon from '../components/icons/BinaryCodeIcon'
import LogoutIcon from '../components/icons/LogoutIcon'
import SuccessIcon from '../components/icons/SuccessIcon'
import { useTelegram } from '../hooks/useTelegram'
import { isTelegramWebApp } from '../lib/api'
import { warmCountryFlagCache } from '../lib/countryFlagCache'
import { fetchOrder } from '../lib/orders'
import type { ShopOrder } from '../lib/orders'
import { fetchVirtualNumberCode, logoutVirtualNumberAccount, splitVirtualNumber, virtualNumberCodeButtonLabel, virtualNumberCodeNotifyType, virtualNumberLogoutNotifyType, type VirtualNumberCodeStatus } from '../lib/virtualNumber'
import '../styles/shop-rise.css'
import './WalletPaymentResult.css'
import './VirtualNumberPaymentSuccess.css'

function formatToman(value: string | number): string {
  const amount = typeof value === 'string' ? Number.parseInt(value, 10) : value
  if (!Number.isFinite(amount)) return '۰'
  return amount.toLocaleString('fa-IR')
}

export function VirtualNumberPaymentSuccessPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const orderId = searchParams.get('orderId')
  const { haptic } = useTelegram()
  const [order, setOrder] = useState<ShopOrder | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(orderId))
  const [verificationCode, setVerificationCode] = useState<string | null>(null)
  const [codeStatus, setCodeStatus] = useState<VirtualNumberCodeStatus | null>(null)
  const [isFetchingCode, setIsFetchingCode] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const codeWaitTimerRef = useRef<number | null>(null)
  const codeRequestIdRef = useRef(0)

  const clearCodeWaitTimer = useCallback(() => {
    if (codeWaitTimerRef.current != null) {
      window.clearTimeout(codeWaitTimerRef.current)
      codeWaitTimerRef.current = null
    }
  }, [])

  useEffect(() => () => clearCodeWaitTimer(), [clearCodeWaitTimer])
  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  }>({
    show: false,
    message: '',
    type: 'success',
  })

  const handleBack = useCallback(() => {
    navigate('/', { replace: true })
  }, [navigate])

  useEffect(() => {
    haptic('medium')
  }, [haptic])

  useEffect(() => {
    let cancelled = false

    const loadOrder = async () => {
      if (!orderId) {
        setIsLoading(false)
        return
      }

      setIsLoading(true)

      try {
        const response = await fetchOrder(orderId)
        if (!cancelled) {
          setOrder(response.order)
          if (response.order.virtualNumber?.loggedOutAt) {
            setVerificationCode(null)
            setCodeStatus('logged_out')
          } else if (response.order.virtualNumber?.code) {
            setVerificationCode(response.order.virtualNumber.code)
            setCodeStatus('ready')
          }
        }
      } catch {
        if (!cancelled) {
          setOrder(null)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadOrder()

    return () => {
      cancelled = true
    }
  }, [orderId])

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

  const purchasedNumber = order?.virtualNumber?.number ?? null
  const range = order?.virtualNumber?.range ?? null
  const isLoggedOut = Boolean(order?.virtualNumber?.loggedOutAt) || codeStatus === 'logged_out'
  const countryLabel = order?.recipientName?.trim() || null
  const flagCode = order?.recipientPhoto?.trim() || null

  useEffect(() => {
    if (flagCode) void warmCountryFlagCache([flagCode])
  }, [flagCode])

  const phoneParts = useMemo(() => {
    if (!purchasedNumber) return null
    return splitVirtualNumber(purchasedNumber, range)
  }, [purchasedNumber, range])

  const showNotification = (
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'success',
  ) => {
    setNotification({ show: true, message, type })
  }

  const hideNotification = () => {
    setNotification((prev) => ({ ...prev, show: false }))
  }

  const copyText = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value)
      haptic('light')
      showNotification(successMessage, 'success')
    } catch {
      showNotification('کپی انجام نشد', 'error')
    }
  }

  const handleFetchCode = async () => {
    if (!orderId || isFetchingCode || isLoggingOut) return

    haptic('light')
    clearCodeWaitTimer()
    const requestId = ++codeRequestIdRef.current
    let timedOut = false
    setVerificationCode(null)
    setCodeStatus('pending')
    setIsFetchingCode(true)

    codeWaitTimerRef.current = window.setTimeout(() => {
      if (codeRequestIdRef.current !== requestId) return
      timedOut = true
      codeWaitTimerRef.current = null
      setIsFetchingCode(false)
      setCodeStatus(null)
      setVerificationCode(null)
    }, 10_000)

    try {
      const response = await fetchVirtualNumberCode(orderId)
      if (codeRequestIdRef.current !== requestId) return

      if (response.status === 'logged_out') {
        clearCodeWaitTimer()
        setCodeStatus('logged_out')
        setVerificationCode(null)
        setOrder((prev) =>
          prev?.virtualNumber
            ? {
                ...prev,
                virtualNumber: {
                  ...prev.virtualNumber,
                  code: null,
                  loggedOutAt: new Date().toISOString(),
                },
              }
            : prev,
        )
        showNotification(response.message, virtualNumberCodeNotifyType(response.status))
        return
      }

      if (response.status === 'pending') {
        if (timedOut) return
        setCodeStatus('pending')
        setVerificationCode(null)
        showNotification(response.message, virtualNumberCodeNotifyType(response.status))
        return
      }

      clearCodeWaitTimer()
      setCodeStatus(response.status)
      setVerificationCode(response.code)

      if (response.status === 'ready' && response.code) {
        setOrder((prev) =>
          prev?.virtualNumber
            ? {
                ...prev,
                virtualNumber: {
                  ...prev.virtualNumber,
                  code: response.code,
                },
              }
            : prev,
        )
      }

      showNotification(response.message, virtualNumberCodeNotifyType(response.status))
    } catch (error) {
      if (codeRequestIdRef.current !== requestId || timedOut) return
      clearCodeWaitTimer()
      setCodeStatus('not_received')
      setVerificationCode(null)
      showNotification(error instanceof Error ? error.message : 'خطا در دریافت کد', 'error')
    } finally {
      if (codeRequestIdRef.current === requestId && !timedOut) {
        setIsFetchingCode(false)
      }
    }
  }

  const handleLogout = async () => {
    if (!orderId || isFetchingCode || isLoggingOut) return

    haptic('light')
    setIsLoggingOut(true)
    try {
      const response = await logoutVirtualNumberAccount(orderId)
      if (response.status === 'logged_out') {
        setCodeStatus('logged_out')
        setVerificationCode(null)
        setOrder((prev) =>
          prev?.virtualNumber
            ? {
                ...prev,
                virtualNumber: {
                  ...prev.virtualNumber,
                  code: null,
                  loggedOutAt: response.loggedOutAt ?? new Date().toISOString(),
                },
              }
            : prev,
        )
      }
      setLogoutConfirmOpen(false)
      showNotification(response.message, virtualNumberLogoutNotifyType(response.status))
    } catch (error) {
      showNotification(error instanceof Error ? error.message : 'خروج از اکانت ناموفق بود', 'error')
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <div className="wallet-payment-result wallet-payment-result--success">
      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={hideNotification}
      />

      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title="خرید موفق" onBack={handleBack} />
      </div>

      <div className="wallet-payment-result__content">
        <section
          className="wallet-payment-result__hero shop-rise"
          style={{ '--rise-index': 1 } as CSSProperties}
        >
          <div className="wallet-payment-result__icon wallet-payment-result__icon--success">
            <SuccessIcon width={34} height={34} />
          </div>
          <h2 className="wallet-payment-result__title">خرید شماره مجازی با موفقیت انجام شد</h2>
          <p className="wallet-payment-result__subtitle">
            سفارش شما با موفقیت ثبت و پردازش شد.
          </p>
        </section>

        <section
          className="vn-success-number shop-rise"
          style={{ '--rise-index': 2 } as CSSProperties}
          aria-label="شماره خریداری‌شده"
        >
          <div className="vn-success-number__head">
            <span className="vn-success-number__title">شماره خریداری شده</span>
            <div className="vn-success-number__actions">
              <button
                type="button"
                className="vn-success-number__copy"
                disabled={!phoneParts}
                onClick={() => {
                  if (!phoneParts) return
                  void copyText(phoneParts.withoutPrefix, 'شماره بدون پیش‌شماره کپی شد')
                }}
              >
                <CopyIcon width={13} height={13} />
                بدون پیش‌شماره
              </button>
              <button
                type="button"
                className="vn-success-number__copy"
                disabled={!phoneParts}
                onClick={() => {
                  if (!phoneParts) return
                  void copyText(phoneParts.withPrefix, 'شماره با پیش‌شماره کپی شد')
                }}
              >
                <CopyIcon width={13} height={13} />
                با پیش‌شماره
              </button>
            </div>
          </div>

          <div className="vn-success-number__body">
            <div className="vn-success-number__phone-box" dir="ltr">
              {isLoading ? (
                <span className="wallet-payment-result__skeleton wallet-payment-result__skeleton--wide" />
              ) : (
                <span className="vn-success-number__value">{phoneParts?.display ?? '—'}</span>
              )}
            </div>

            {!isLoggedOut ? (
              <div className="vn-success-number__ops">
                <button
                  type="button"
                  className="vn-success-number__logout-btn"
                  disabled={!phoneParts || isFetchingCode || isLoggingOut}
                  onClick={() => {
                    haptic('light')
                    setLogoutConfirmOpen(true)
                  }}
                >
                  <LogoutIcon width={13} height={13} />
                  خروج
                </button>
                <button
                  type="button"
                  className={`vn-success-number__code-btn${
                    codeStatus ? ` vn-success-number__code-btn--${codeStatus}` : ''
                  }`}
                  disabled={!phoneParts || isFetchingCode || isLoggingOut}
                  onClick={() => void handleFetchCode()}
                >
                  <BinaryCodeIcon width={14} height={14} />
                  {virtualNumberCodeButtonLabel(codeStatus, isFetchingCode, Boolean(verificationCode))}
                </button>
              </div>
            ) : null}
          </div>

          {isLoggedOut ? (
            <p className="vn-success-number__logged-out-note">شما از این شماره لوگ اوت کرده‌اید</p>
          ) : null}
        </section>

        {!isLoggedOut ? (
        <section
          className="vn-success-number shop-rise"
          style={{ '--rise-index': 3 } as CSSProperties}
          aria-label="کد تأیید"
        >
          <div className="vn-success-number__head">
            <span className="vn-success-number__title">کد تأیید</span>
          </div>

          <div className="vn-success-number__body">
            <div className="vn-success-number__phone-box">
              {isFetchingCode || codeStatus === 'pending' ? (
                <span className="vn-success-number__value vn-success-number__value--muted" dir="rtl">
                  در انتظار کد...
                </span>
              ) : verificationCode ? (
                <span className="vn-success-number__value" dir="ltr">
                  {verificationCode}
                </span>
              ) : codeStatus === 'not_received' ? (
                <span className="vn-success-number__value vn-success-number__value--muted" dir="rtl">
                  کد دریافت نشده
                </span>
              ) : (
                <span className="vn-success-number__value vn-success-number__value--muted" dir="rtl">
                  —
                </span>
              )}
            </div>

            <button
              type="button"
              className="vn-success-number__code-btn"
              disabled={!verificationCode}
              onClick={() => {
                if (!verificationCode) return
                void copyText(verificationCode, 'کد تأیید کپی شد')
              }}
            >
              کپی کد
            </button>
          </div>
        </section>
        ) : null}

        <section
          className="wallet-payment-result__card shop-rise"
          style={{ '--rise-index': 4 } as CSSProperties}
          aria-label="جزئیات سفارش"
        >
          <div className="wallet-payment-result__row">
            <span className="wallet-payment-result__row-label">مبلغ پرداختی</span>
            {isLoading ? (
              <span className="wallet-payment-result__skeleton" />
            ) : (
              <span className="wallet-payment-result__row-value wallet-payment-result__row-value--amount">
                <span className="wallet-payment-result__row-unit">تومان</span>
                <span>{order ? formatToman(order.amountToman) : '—'}</span>
              </span>
            )}
          </div>
          {countryLabel ? (
            <div className="wallet-payment-result__row">
              <span className="wallet-payment-result__row-label">کشور</span>
              {isLoading ? (
                <span className="wallet-payment-result__skeleton" />
              ) : (
                <span className="vn-success-country">
                  {flagCode ? (
                    <CountryFlagImg
                      flagCode={flagCode}
                      className="vn-success-country__flag"
                      width={24}
                      height={18}
                    />
                  ) : null}
                  <span className="vn-success-country__name">{countryLabel}</span>
                </span>
              )}
            </div>
          ) : null}
          <div className="wallet-payment-result__row">
            <span className="wallet-payment-result__row-label">شماره سفارش</span>
            {isLoading ? (
              <span className="wallet-payment-result__skeleton" />
            ) : (
              <span className="wallet-payment-result__row-value">
                {order?.orderId ?? orderId ?? '—'}
              </span>
            )}
          </div>
        </section>
      </div>

      <footer
        className="wallet-payment-result__footer vn-success-footer shop-rise"
        style={{ '--rise-index': 5 } as CSSProperties}
      >
        <button
          type="button"
          className="vn-success-footer__primary"
          onClick={() => {
            haptic('light')
            handleBack()
          }}
        >
          رفتن به فروشگاه
        </button>
        <button
          type="button"
          className="vn-success-footer__secondary"
          onClick={() => {
            haptic('light')
            navigate('/dashboard', { replace: true })
          }}
        >
          داشبورد
        </button>
      </footer>

      <CenterModal
        isOpen={logoutConfirmOpen}
        onClose={() => {
          if (isLoggingOut) return
          setLogoutConfirmOpen(false)
        }}
        title="تأیید خروج از حساب"
        description="ما از طریق وب‌سرویس به حساب تلگرام این شماره متصلیم و به پیام‌های شما دسترسی نداریم. با این اتصال می‌توانیم کد ورود را دوباره دریافت کنیم؛ با خروج قطعی، این دسترسی حذف می‌شود و مسئولیت نگهداری حساب بر عهده شماست."
        showCloseButton={!isLoggingOut}
        buttons={[
          {
            label: 'انصراف',
            onClick: () => setLogoutConfirmOpen(false),
            disabled: isLoggingOut,
          },
          {
            label: isLoggingOut ? 'در حال خروج...' : 'خروج قطعی',
            onClick: () => void handleLogout(),
            variant: 'danger',
            disabled: isLoggingOut,
          },
        ]}
      />
    </div>
  )
}
