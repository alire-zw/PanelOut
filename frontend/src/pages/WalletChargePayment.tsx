import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import BankCardIcon from '../components/icons/BankCardIcon'
import DepositCryptoIcon from '../components/icons/DepositCryptoIcon'
import { formatAmountFa, isChargeAmountValid } from '../lib/amount'
import { isTelegramWebApp } from '../lib/telegram'
import { useTelegram } from '../hooks/useTelegram'
import type { ChargePaymentMethod, WalletChargeAmountState } from '../types/wallet'
import '../styles/shop-rise.css'
import './WalletChargePayment.css'

type PaymentMethodOption = {
  id: ChargePaymentMethod
  title: string
  subtitle: string
  Icon: typeof BankCardIcon
}

const PAYMENT_METHODS: PaymentMethodOption[] = [
  {
    id: 'card',
    title: 'کارت‌به‌کارت',
    subtitle: 'واریز به کارت و آپلود رسید',
    Icon: BankCardIcon,
  },
  {
    id: 'tron',
    title: 'پرداخت با ترون',
    subtitle: 'پرداخت از طریق شبکه TRON',
    Icon: DepositCryptoIcon,
  },
]

export function WalletChargePaymentPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { haptic } = useTelegram()
  const chargeState = location.state as WalletChargeAmountState | null
  const amount = chargeState?.amount ?? 0
  const [method, setMethod] = useState<ChargePaymentMethod>('card')

  const handleBack = useCallback(() => {
    navigate('/wallet/charge', { state: { amount }, replace: true })
  }, [navigate, amount])

  useEffect(() => {
    if (isChargeAmountValid(amount)) return
    navigate('/wallet/charge', { replace: true })
  }, [amount, navigate])

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

  if (!isChargeAmountValid(amount)) return null

  const handleContinue = () => {
    haptic('light')
    if (method === 'tron') {
      navigate('/wallet/charge/tron', { state: { amount } })
      return
    }
    navigate('/wallet/charge/card', { state: { amount } })
  }

  return (
    <div className="wallet-charge-payment">
      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title="انتخاب روش پرداخت" onBack={handleBack} />
      </div>

      <div className="wallet-charge-payment__content">
        <section
          className="wallet-charge-payment__summary shop-rise"
          style={{ '--rise-index': 1 } as CSSProperties}
          aria-label="مبلغ شارژ"
        >
          <span className="wallet-charge-payment__summary-label">مبلغ قابل پرداخت</span>
          <div className="wallet-charge-payment__summary-value-row">
            <span className="wallet-charge-payment__summary-unit">تومان</span>
            <span className="wallet-charge-payment__summary-value">
              {formatAmountFa(String(amount))}
            </span>
          </div>
        </section>

        <h2
          className="wallet-charge-payment__section-title shop-rise"
          style={{ '--rise-index': 2 } as CSSProperties}
        >
          روش پرداخت
        </h2>

        <div
          className="wallet-charge-payment__methods shop-rise"
          style={{ '--rise-index': 3 } as CSSProperties}
          role="radiogroup"
          aria-label="روش پرداخت"
        >
          {PAYMENT_METHODS.map((option) => {
            const isSelected = method === option.id
            const Icon = option.Icon
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                className={`wallet-charge-payment__method${
                  isSelected ? ' wallet-charge-payment__method--selected' : ''
                }`}
                onClick={() => {
                  haptic('light')
                  setMethod(option.id)
                }}
              >
                <span className="wallet-charge-payment__method-icon">
                  <Icon width={18} height={18} />
                </span>
                <span className="wallet-charge-payment__method-text">
                  <span className="wallet-charge-payment__method-title">{option.title}</span>
                  <span className="wallet-charge-payment__method-subtitle">{option.subtitle}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <footer
        className="wallet-charge-payment__footer shop-rise"
        style={{ '--rise-index': 4 } as CSSProperties}
      >
        <button type="button" className="wallet-charge-payment__continue" onClick={handleContinue}>
          ادامه
        </button>
      </footer>
    </div>
  )
}
