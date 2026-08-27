import { useCallback, useEffect, type CSSProperties } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import PaymentFailedIcon from '../components/icons/PaymentFailedIcon'
import { useTelegram } from '../hooks/useTelegram'
import { isTelegramWebApp } from '../lib/api'
import '../styles/shop-rise.css'
import './WalletPaymentResult.css'

export function VirtualNumberPaymentFailedPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const orderId = searchParams.get('orderId')
  const { haptic } = useTelegram()

  const handleBack = useCallback(() => {
    navigate('/virtual-number', { replace: true })
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
    <div className="wallet-payment-result wallet-payment-result--failed">
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
          <h2 className="wallet-payment-result__title">خرید شماره مجازی انجام نشد</h2>
          <p className="wallet-payment-result__subtitle">
            پرداخت یا ثبت سفارش با خطا مواجه شد. در صورت کسر وجه، موجودی به‌زودی برمی‌گردد.
          </p>
        </section>

        {orderId ? (
          <section
            className="wallet-payment-result__card shop-rise"
            style={{ '--rise-index': 2 } as CSSProperties}
          >
            <div className="wallet-payment-result__row">
              <span className="wallet-payment-result__row-label">شماره سفارش</span>
              <span className="wallet-payment-result__row-value">{orderId}</span>
            </div>
          </section>
        ) : null}
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
            handleBack()
          }}
        >
          بازگشت به شماره مجازی
        </button>
      </footer>
    </div>
  )
}
