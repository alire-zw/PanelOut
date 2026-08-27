import { useCallback, useEffect, type CSSProperties } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import PaymentFailedIcon from '../components/icons/PaymentFailedIcon'
import { useTelegram } from '../hooks/useTelegram'
import { isTelegramWebApp } from '../lib/api'
import '../styles/shop-rise.css'
import './WalletPaymentResult.css'
import './StarsPaymentResult.css'

export function StarsPaymentFailedPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const orderId = searchParams.get('orderId')
  const { haptic } = useTelegram()

  const handleBack = useCallback(() => {
    navigate('/stars', { replace: true })
  }, [navigate])

  useEffect(() => {
    haptic('medium')
  }, [haptic])

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

  return (
    <div className="wallet-payment-result wallet-payment-result--failed wallet-payment-result--stars">
      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title="خرید ناموفق" onBack={handleBack} />
      </div>

      <div className="wallet-payment-result__content">
        <section
          className="wallet-payment-result__hero shop-rise"
          style={{ '--rise-index': 1 } as CSSProperties}
        >
          <div className="wallet-payment-result__icon wallet-payment-result__icon--failed">
            <PaymentFailedIcon width={34} height={34} />
          </div>
          <h2 className="wallet-payment-result__title">خرید استارز انجام نشد</h2>
          <p className="wallet-payment-result__subtitle">
            پرداخت شما تکمیل نشد یا توسط شما لغو شد. در صورت کسر وجه، طی ۷۲ ساعت به حساب شما
            بازگردانده می‌شود.
          </p>
        </section>

        {orderId ? (
          <section
            className="wallet-payment-result__card shop-rise"
            style={{ '--rise-index': 2 } as CSSProperties}
            aria-label="جزئیات سفارش"
          >
            <div className="wallet-payment-result__row">
              <span className="wallet-payment-result__row-label">شماره سفارش</span>
              <span className="wallet-payment-result__row-value">{orderId}</span>
            </div>
          </section>
        ) : null}
      </div>

      <footer
        className="wallet-payment-result__footer stars-success-footer shop-rise"
        style={{ '--rise-index': 3 } as CSSProperties}
      >
        <button
          type="button"
          className="stars-success-footer__primary"
          onClick={() => {
            haptic('light')
            handleBack()
          }}
        >
          تلاش مجدد
        </button>
        <button
          type="button"
          className="stars-success-footer__secondary"
          onClick={() => {
            haptic('light')
            navigate('/', { replace: true })
          }}
        >
          بازگشت به فروشگاه
        </button>
      </footer>
    </div>
  )
}
