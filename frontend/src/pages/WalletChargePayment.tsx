import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import BankCardIcon from '../components/icons/BankCardIcon'
import DepositCryptoIcon from '../components/icons/DepositCryptoIcon'
import { formatAmountFa, isChargeAmountValid } from '../lib/amount'
import { fetchPaymentMethods } from '../lib/paymentsApi'
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
    subtitle: 'واریز TRX به آدرس اختصاصی',
    Icon: DepositCryptoIcon,
  },
]

function PaymentMethodSkeleton() {
  return (
    <>
      {[0, 1].map((index) => (
        <div
          key={index}
          className="wallet-charge-payment__method wallet-charge-payment__method--skeleton"
          aria-hidden="true"
        >
          <span className="wallet-charge-payment__method-skeleton-icon" />
          <span className="wallet-charge-payment__method-skeleton-text">
            <span className="wallet-charge-payment__method-skeleton-title" />
            <span className="wallet-charge-payment__method-skeleton-subtitle" />
          </span>
        </div>
      ))}
    </>
  )
}

export function WalletChargePaymentPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { haptic } = useTelegram()
  const chargeState = location.state as WalletChargeAmountState | null
  const amount = chargeState?.amount ?? 0
  const [method, setMethod] = useState<ChargePaymentMethod>('card')
  const [methodsLoading, setMethodsLoading] = useState(true)
  const [availableMethods, setAvailableMethods] = useState({ tron: true, card: true })

  const visibleMethods = useMemo(
    () => PAYMENT_METHODS.filter((option) => availableMethods[option.id]),
    [availableMethods],
  )

  const handleBack = useCallback(() => {
    navigate('/wallet/charge', { state: { amount }, replace: true })
  }, [navigate, amount])

  useEffect(() => {
    if (isChargeAmountValid(amount)) return
    navigate('/wallet/charge', { replace: true })
  }, [amount, navigate])

  useEffect(() => {
    if (!isChargeAmountValid(amount)) return
    let cancelled = false
    void fetchPaymentMethods()
      .then((methods) => {
        if (cancelled) return
        setAvailableMethods(methods)
        if (methods.tron && !methods.card) setMethod('tron')
        if (methods.card && !methods.tron) setMethod('card')
      })
      .catch(() => {
        if (!cancelled) setAvailableMethods({ tron: false, card: true })
      })
      .finally(() => {
        if (!cancelled) setMethodsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [amount])

  useEffect(() => {
    if (methodsLoading) return
    if (visibleMethods.length === 1) {
      setMethod(visibleMethods[0]!.id)
    }
  }, [methodsLoading, visibleMethods])

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

  if (!methodsLoading && visibleMethods.length === 0) {
    return (
      <div className="wallet-charge-payment">
        <PageHeader title="انتخاب روش پرداخت" onBack={handleBack} />
        <p className="wallet-charge-payment__empty">در حال حاضر روش پرداختی فعال نیست.</p>
      </div>
    )
  }

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
          {methodsLoading ? (
            <PaymentMethodSkeleton />
          ) : (
            visibleMethods.map((option) => {
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
            })
          )}
        </div>
      </div>

      <footer
        className="wallet-charge-payment__footer shop-rise"
        style={{ '--rise-index': 4 } as CSSProperties}
      >
        <button
          type="button"
          className="wallet-charge-payment__continue"
          onClick={handleContinue}
          disabled={methodsLoading || visibleMethods.length === 0}
        >
          ادامه
        </button>
      </footer>
    </div>
  )
}
