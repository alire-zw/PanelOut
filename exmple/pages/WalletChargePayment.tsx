import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Notification } from '../components/Notification'
import { PageHeader } from '../components/PageHeader'
import BankCardIcon from '../components/icons/BankCardIcon'
import DepositCryptoIcon from '../components/icons/DepositCryptoIcon'
import { useUser } from '../context/UserContext'
import { formatAmountFa, isChargeAmountValid } from '../lib/amount'
import { isTelegramWebApp } from '../lib/api'
import { getKycNextPath, isUserKycVerified } from '../lib/kyc'
import { createPaymentRequest, openPaymentUrl } from '../lib/payments'
import { createCryptoPaymentRequest } from '../lib/cryptoPayments'
import { useTelegram } from '../hooks/useTelegram'
import type { ChargePaymentMethod, WalletChargeAmountState } from '../types/wallet'
import '../styles/shop-rise.css'
import './WalletChargePayment.css'

interface PaymentMethodOption {
  id: ChargePaymentMethod
  title: string
  subtitle: string
  Icon: typeof BankCardIcon
}

const PAYMENT_METHODS: PaymentMethodOption[] = [
  {
    id: 'zibal',
    title: 'درگاه آنلاین زیبال',
    subtitle: 'پرداخت از طریق درگاه بانکی',
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
  const { user } = useUser()
  const chargeState = location.state as WalletChargeAmountState | null
  const amount = chargeState?.amount ?? 0

  const [method, setMethod] = useState<ChargePaymentMethod>('zibal')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  }>({
    show: false,
    message: '',
    type: 'error',
  })

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

  if (!isChargeAmountValid(amount)) {
    return null
  }

  const showNotification = (
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'error',
  ) => {
    setNotification({ show: true, message, type })
  }

  const hideNotification = () => {
    setNotification((prev) => ({ ...prev, show: false }))
  }

  const handleMethodSelect = (nextMethod: ChargePaymentMethod) => {
    haptic('light')
    setMethod(nextMethod)
  }

  const handleContinue = async () => {
    if (isSubmitting) return

    if (method === 'tron') {
      haptic('light')
      setIsSubmitting(true)

      try {
        const response = await createCryptoPaymentRequest(amount)
        navigate(
          `/wallet/charge/tron?orderId=${encodeURIComponent(response.payment.orderId)}`,
          { replace: true },
        )
      } catch (error) {
        showNotification(
          error instanceof Error ? error.message : 'خطا در ایجاد پرداخت ترون',
          'error',
        )
      } finally {
        setIsSubmitting(false)
      }
      return
    }

    haptic('light')

    if (!isUserKycVerified(user)) {
      const kycPath = getKycNextPath(user)
      if (kycPath) {
        navigate(kycPath, {
          state: {
            product: 'wallet-charge' as const,
            amount,
            toman: amount,
            method: 'zibal' as const,
          },
        })
        return
      }
    }

    setIsSubmitting(true)

    try {
      const response = await createPaymentRequest(amount, `شارژ کیف پول`)
      openPaymentUrl(response.paymentUrl)
    } catch (error) {
      showNotification(error instanceof Error ? error.message : 'خطا در ایجاد پرداخت', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="wallet-charge-payment">
      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={hideNotification}
      />

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
                onClick={() => handleMethodSelect(option.id)}
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
        <button
          type="button"
          className="wallet-charge-payment__continue"
          disabled={isSubmitting}
          onClick={() => void handleContinue()}
        >
          {isSubmitting
            ? method === 'tron'
              ? 'در حال ایجاد پرداخت...'
              : 'در حال انتقال به درگاه...'
            : 'ادامه'}
        </button>
      </footer>
    </div>
  )
}
