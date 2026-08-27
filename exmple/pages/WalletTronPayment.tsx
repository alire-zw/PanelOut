import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { QRCode } from 'react-qrcode-logo'
import { PageHeader } from '../components/PageHeader'
import PaymentFailedIcon from '../components/icons/PaymentFailedIcon'
import { fetchCryptoPaymentOrder } from '../lib/cryptoPayments'
import { isTelegramWebApp } from '../lib/api'
import { useTelegram } from '../hooks/useTelegram'
import type { CryptoPayment } from '../types/cryptoPayment'
import '../styles/shop-rise.css'
import './WalletTronPayment.css'

const STATUS_POLL_MS = 10_000

function resolveQrColors() {
  const accent =
    getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#6366f1'
  const isLight = document.documentElement.getAttribute('data-theme') === 'light'

  return {
    fgColor: isLight ? '#18181b' : '#111113',
    eyeColor: accent,
    bgColor: '#ffffff',
  }
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatTrxAmount(amount: string | number | null | undefined): string {
  if (amount === null || amount === undefined) return '0.00'
  const value = typeof amount === 'string' ? Number.parseFloat(amount) : amount
  if (!Number.isFinite(value)) return '0.00'
  return value.toFixed(2)
}

function formatToman(value: string | number): string {
  const amount = typeof value === 'string' ? Number.parseInt(value, 10) : value
  if (!Number.isFinite(amount)) return '۰'
  return amount.toLocaleString('fa-IR')
}

function TronPaymentSkeleton() {
  return (
    <div className="tron-payment__skeleton">
      <div className="tron-payment__skeleton-title-row">
        <div className="tron-payment__skeleton-block tron-payment__skeleton-title" />
        <div className="tron-payment__skeleton-block tron-payment__skeleton-timer" />
      </div>
      <div className="tron-payment__skeleton-block tron-payment__skeleton-instructions" />
      <div className="tron-payment__skeleton-address-row">
        <div className="tron-payment__skeleton-block tron-payment__skeleton-qr" />
        <div className="tron-payment__skeleton-block tron-payment__skeleton-address" />
      </div>
      <div className="tron-payment__skeleton-block tron-payment__skeleton-amount" />
    </div>
  )
}

export function WalletTronPaymentPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const orderId = searchParams.get('orderId')
  const { haptic } = useTelegram()

  const [payment, setPayment] = useState<CryptoPayment | null>(null)
  const [loading, setLoading] = useState(true)
  const [isChecking, setIsChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [copied, setCopied] = useState(false)
  const [qrColors, setQrColors] = useState(resolveQrColors)

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearTimers = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const handleBack = useCallback(() => {
    navigate('/wallet/charge/payment', { replace: true })
  }, [navigate])

  const goToFailed = useCallback(
    (id?: string, shopOrderId?: string | null) => {
      const params = new URLSearchParams()
      const resolvedId = shopOrderId ?? id
      if (resolvedId) params.set('orderId', resolvedId)
      const query = params.toString()
      const basePath = shopOrderId?.startsWith('PB-')
        ? '/premium/payment/failed'
        : shopOrderId
          ? '/stars/payment/failed'
          : '/wallet/payment/failed'
      navigate(`${basePath}${query ? `?${query}` : ''}`, { replace: true })
    },
    [navigate],
  )

  const goToSuccess = useCallback(
    (id: string, shopOrderId?: string | null) => {
      if (shopOrderId?.startsWith('PB-')) {
        navigate(`/premium/payment/success?orderId=${encodeURIComponent(shopOrderId)}`, {
          replace: true,
        })
        return
      }

      if (shopOrderId) {
        navigate(`/stars/payment/success?orderId=${encodeURIComponent(shopOrderId)}`, {
          replace: true,
        })
        return
      }

      navigate(`/wallet/payment/success?orderId=${encodeURIComponent(id)}`, { replace: true })
    },
    [navigate],
  )

  const syncCountdown = useCallback(
    (nextPayment: CryptoPayment) => {
      const expiresAt = new Date(nextPayment.expiresAt).getTime()
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))
      setTimeLeft(remaining)

      if (countdownRef.current) {
        clearInterval(countdownRef.current)
        countdownRef.current = null
      }

      if (nextPayment.status !== 'pending' || remaining <= 0) {
        return
      }

      countdownRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current)
            goToFailed(nextPayment.orderId, nextPayment.shopOrderId)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    },
    [goToFailed],
  )

  const loadPayment = useCallback(
    async (options?: { manual?: boolean }) => {
      if (!orderId) {
        setError('شناسه سفارش یافت نشد')
        setLoading(false)
        return
      }

      if (options?.manual) {
        setIsChecking(true)
      }

      try {
        const response = await fetchCryptoPaymentOrder(orderId)
        const nextPayment = response.payment
        setPayment(nextPayment)
        setError(null)

        if (nextPayment.status === 'completed' || nextPayment.status === 'swept') {
          clearTimers()
          goToSuccess(nextPayment.orderId, nextPayment.shopOrderId)
          return
        }

        if (nextPayment.status === 'expired') {
          clearTimers()
          goToFailed(nextPayment.orderId, nextPayment.shopOrderId)
          return
        }

        syncCountdown(nextPayment)

        const expiresAt = new Date(nextPayment.expiresAt).getTime()
        if (nextPayment.status === 'pending' && expiresAt <= Date.now()) {
          clearTimers()
          goToFailed(nextPayment.orderId, nextPayment.shopOrderId)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'خطا در دریافت اطلاعات پرداخت')
      } finally {
        setLoading(false)
        if (options?.manual) {
          setIsChecking(false)
        }
      }
    },
    [clearTimers, goToFailed, goToSuccess, orderId, syncCountdown],
  )

  useEffect(() => {
    setQrColors(resolveQrColors())
    void loadPayment()

    pollRef.current = setInterval(() => {
      void loadPayment()
    }, STATUS_POLL_MS)

    return () => {
      clearTimers()
    }
  }, [clearTimers, loadPayment])

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

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      haptic('light')
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('کپی آدرس انجام نشد')
    }
  }

  const handleCheckPayment = () => {
    haptic('light')
    void loadPayment({ manual: true })
  }

  if (!orderId) {
    return (
      <div className="tron-payment">
        <PageHeader title="پرداخت با ترون" onBack={handleBack} />
        <div className="tron-payment__state">
          <div className="tron-payment__icon tron-payment__icon--error">
            <PaymentFailedIcon width={48} height={48} />
          </div>
          <h2 className="tron-payment__title tron-payment__title--center">خطا</h2>
          <p className="tron-payment__description">شناسه سفارش یافت نشد</p>
        </div>
      </div>
    )
  }

  if (loading && !payment) {
    return (
      <div className="tron-payment">
        <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
          <PageHeader title="پرداخت با ترون" onBack={handleBack} />
        </div>
        <div className="tron-payment__content">
          <div className="tron-payment__card shop-rise" style={{ '--rise-index': 1 } as CSSProperties}>
            <TronPaymentSkeleton />
          </div>
        </div>
      </div>
    )
  }

  if (error || !payment) {
    return (
      <div className="tron-payment">
        <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
          <PageHeader title="پرداخت با ترون" onBack={handleBack} />
        </div>
        <div className="tron-payment__state shop-rise" style={{ '--rise-index': 1 } as CSSProperties}>
          <div className="tron-payment__icon tron-payment__icon--error">
            <PaymentFailedIcon width={48} height={48} />
          </div>
          <h2 className="tron-payment__title tron-payment__title--center">خطا</h2>
          <p className="tron-payment__description">{error ?? 'اطلاعات پرداخت یافت نشد'}</p>
        </div>
        <footer className="tron-payment__footer shop-rise" style={{ '--rise-index': 2 } as CSSProperties}>
          <button
            type="button"
            className="tron-payment__footer-btn"
            disabled={isChecking}
            onClick={handleCheckPayment}
          >
            {isChecking ? 'در حال بررسی...' : 'بررسی پرداخت'}
          </button>
        </footer>
      </div>
    )
  }

  return (
    <div className="tron-payment">
      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title="پرداخت با ترون" onBack={handleBack} />
      </div>

      <div className="tron-payment__content">
        <div className="tron-payment__card shop-rise" style={{ '--rise-index': 1 } as CSSProperties}>
          <div className="tron-payment__title-row">
            <h1 className="tron-payment__title">پرداخت با ترون</h1>
            <div className="tron-payment__timer-wrap">
              <div className="tron-payment__timer-label">زمان باقی‌مانده:</div>
              <div className={`tron-payment__timer${timeLeft < 60 ? ' tron-payment__timer--warning' : ''}`}>
                {formatTime(timeLeft)}
              </div>
            </div>
          </div>

          <div className="tron-payment__instructions">
            <p>
              لطفاً دقیقاً <strong>{formatTrxAmount(payment.amountTrx)} TRX</strong> را به آدرس زیر
              ارسال کنید.
            </p>
            <p>پس از ارسال، پرداخت به صورت خودکار تأیید می‌شود.</p>
          </div>

          <div className="tron-payment__address-row">
            <div className="tron-payment__qr-box">
              <QRCode
                value={payment.walletAddress}
                size={118}
                ecLevel="H"
                qrStyle="dots"
                eyeRadius={6}
                eyeColor={qrColors.eyeColor}
                bgColor={qrColors.bgColor}
                fgColor={qrColors.fgColor}
                quietZone={6}
              />
            </div>
            <div className="tron-payment__address-box">
              <div className="tron-payment__address-label">آدرس کیف پول:</div>
              <div className="tron-payment__address-value-wrap">
                <code className="tron-payment__address-value">{payment.walletAddress}</code>
              </div>
              <button
                type="button"
                className="tron-payment__copy-btn"
                onClick={() => void copyToClipboard(payment.walletAddress)}
              >
                {copied ? 'کپی شد!' : 'کپی'}
              </button>
            </div>
          </div>

          <div className="tron-payment__amount-box">
            <div className="tron-payment__row">
              <span className="tron-payment__label">مبلغ پرداخت:</span>
              <span className="tron-payment__value tron-payment__value--amount">
                {formatToman(payment.amountToman)} تومان
              </span>
            </div>
            <div className="tron-payment__row">
              <span className="tron-payment__label">مبلغ TRX:</span>
              <span className="tron-payment__value">{formatTrxAmount(payment.amountTrx)} TRX</span>
            </div>
            <div className="tron-payment__row">
              <span className="tron-payment__label">قیمت TRX:</span>
              <span className="tron-payment__value">{formatToman(payment.trxIrtRate)} تومان</span>
            </div>
            <div className="tron-payment__row">
              <span className="tron-payment__label">شماره سفارش:</span>
              <span className="tron-payment__value">{payment.orderId}</span>
            </div>
          </div>
        </div>
      </div>

      <footer className="tron-payment__footer shop-rise" style={{ '--rise-index': 2 } as CSSProperties}>
        <button
          type="button"
          className="tron-payment__footer-btn"
          disabled={isChecking}
          onClick={handleCheckPayment}
        >
          {isChecking ? 'در حال بررسی...' : 'بررسی پرداخت'}
        </button>
      </footer>
    </div>
  )
}
