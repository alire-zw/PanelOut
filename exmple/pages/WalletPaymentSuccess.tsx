import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import SuccessIcon from '../components/icons/SuccessIcon'
import { useTelegram } from '../hooks/useTelegram'
import { isTelegramWebApp } from '../lib/api'
import { fetchCryptoPaymentOrder } from '../lib/cryptoPayments'
import { fetchPaymentOrder } from '../lib/payments'
import '../styles/shop-rise.css'
import './WalletPaymentResult.css'

function formatToman(value: string | number): string {
  const amount = typeof value === 'string' ? Number.parseInt(value, 10) : value
  if (!Number.isFinite(amount)) return '۰'
  return amount.toLocaleString('fa-IR')
}

export function WalletPaymentSuccessPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const orderId = searchParams.get('orderId')
  const { haptic } = useTelegram()
  const [chargedAmount, setChargedAmount] = useState<string | null>(null)
  const [resolvedOrderId, setResolvedOrderId] = useState<string | null>(orderId)
  const [isPaymentLoading, setIsPaymentLoading] = useState(Boolean(orderId))

  const handleBack = useCallback(() => {
    navigate('/', { replace: true })
  }, [navigate])

  useEffect(() => {
    haptic('medium')
  }, [haptic])

  useEffect(() => {
    let cancelled = false

    const loadPayment = async () => {
      if (!orderId) {
        setIsPaymentLoading(false)
        return
      }

      setIsPaymentLoading(true)

      try {
        try {
          const response = await fetchPaymentOrder(orderId)
          if (!cancelled) {
            setChargedAmount(formatToman(response.payment.amountToman))
            setResolvedOrderId(response.payment.orderId)
          }
        } catch {
          const response = await fetchCryptoPaymentOrder(orderId)
          if (!cancelled) {
            setChargedAmount(formatToman(response.payment.amountToman))
            setResolvedOrderId(response.payment.orderId)
          }
        }
      } catch {
        if (!cancelled) {
          setChargedAmount(null)
          setResolvedOrderId(orderId)
        }
      } finally {
        if (!cancelled) {
          setIsPaymentLoading(false)
        }
      }
    }

    void loadPayment()

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

  const chargedAmountDisplay = chargedAmount

  return (
    <div className="wallet-payment-result wallet-payment-result--success">
      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title="پرداخت موفق" onBack={handleBack} />
      </div>

      <div className="wallet-payment-result__content">
        <section
          className="wallet-payment-result__hero shop-rise"
          style={{ '--rise-index': 1 } as CSSProperties}
        >
          <div className="wallet-payment-result__icon wallet-payment-result__icon--success">
            <SuccessIcon width={34} height={34} />
          </div>
          <h2 className="wallet-payment-result__title">پرداخت با موفقیت انجام شد</h2>
          <p className="wallet-payment-result__subtitle">
            تراکنش شما تأیید شد و مبلغ پرداختی به کیف پول شما افزوده گردید.
          </p>
        </section>

        <section
          className="wallet-payment-result__card shop-rise"
          style={{ '--rise-index': 2 } as CSSProperties}
          aria-label="جزئیات پرداخت"
        >
          <div className="wallet-payment-result__row">
            <span className="wallet-payment-result__row-label">مبلغ شارژ شده</span>
            {isPaymentLoading ? (
              <span className="wallet-payment-result__skeleton" />
            ) : (
              <span className="wallet-payment-result__row-value wallet-payment-result__row-value--amount">
                <span className="wallet-payment-result__row-unit">تومان</span>
                <span>{chargedAmountDisplay ?? '—'}</span>
              </span>
            )}
          </div>
          <div className="wallet-payment-result__row">
            <span className="wallet-payment-result__row-label">شماره سفارش</span>
            {isPaymentLoading ? (
              <span className="wallet-payment-result__skeleton" />
            ) : (
              <span className="wallet-payment-result__row-value">
                {resolvedOrderId ?? orderId ?? '—'}
              </span>
            )}
          </div>
        </section>
      </div>

      <footer
        className="wallet-payment-result__footer shop-rise"
        style={{ '--rise-index': 3 } as CSSProperties}
      >
        <button
          type="button"
          className="wallet-payment-result__primary"
          onClick={() => {
            haptic('light')
            navigate('/', { replace: true })
          }}
        >
          رفتن به فروشگاه
        </button>
        <button
          type="button"
          className="wallet-payment-result__secondary"
          onClick={() => {
            haptic('light')
            navigate('/dashboard', { replace: true })
          }}
        >
          داشبورد
        </button>
      </footer>
    </div>
  )
}
