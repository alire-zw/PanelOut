import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ConfirmPaymentMethods,
  getConfirmPayableToman,
  getDefaultConfirmPaymentMethod,
} from '../components/ConfirmPaymentMethods'
import { Notification } from '../components/Notification'
import { PageHeader } from '../components/PageHeader'
import { useUser } from '../context/UserContext'
import { useTelegram } from '../hooks/useTelegram'
import { balanceToToman, isTelegramWebApp } from '../lib/api'
import { getKycNextPath, isUserKycVerified } from '../lib/kyc'
import { openPaymentUrl } from '../lib/payments'
import {
  purchasePremiumWithGateway,
  purchasePremiumWithWallet,
} from '../lib/premium'
import {
  PREMIUM_PLAN_LABELS,
  type PremiumConfirmState,
  type PremiumMonths,
  type PremiumPaymentMethod,
} from '../types/premium'
import '../styles/shop-rise.css'
import './PremiumConfirm.css'

const VALID_MONTHS: PremiumMonths[] = [3, 6, 12]

function isValidConfirmState(state: PremiumConfirmState | null): state is PremiumConfirmState {
  if (!state?.recipient) return false
  if (!VALID_MONTHS.includes(state.months)) return false
  if (!Number.isFinite(state.toman) || state.toman <= 0) return false
  return true
}

export function PremiumConfirmPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, refetch } = useUser()
  const { haptic } = useTelegram()
  const confirmState = location.state as PremiumConfirmState | null
  const balance = user ? balanceToToman(user.balance) : 0

  const [method, setMethod] = useState<PremiumPaymentMethod>(() =>
    getDefaultConfirmPaymentMethod(
      balance,
      isValidConfirmState(confirmState) ? confirmState.toman : 0,
    ),
  )
  const [useWalletBalance, setUseWalletBalance] = useState(false)
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

  useEffect(() => {
    if (!isValidConfirmState(confirmState)) return
    if (balance < confirmState.toman) {
      setMethod('zibal')
      setUseWalletBalance(false)
    }
  }, [balance, confirmState])

  const handleBack = useCallback(() => {
    if (!isValidConfirmState(confirmState)) {
      navigate('/premium', { replace: true })
      return
    }

    navigate('/premium', {
      replace: true,
      state: {
        recipient: confirmState.recipient,
        months: confirmState.months,
      },
    })
  }, [confirmState, navigate])

  useEffect(() => {
    if (isValidConfirmState(confirmState)) return
    navigate('/premium', { replace: true })
  }, [confirmState, navigate])

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

  const walletInsufficient = useMemo(() => {
    if (!isValidConfirmState(confirmState)) return false
    return balance < confirmState.toman
  }, [balance, confirmState])

  if (!isValidConfirmState(confirmState)) {
    return null
  }

  const { recipient, months, toman } = confirmState
  const payableToman = getConfirmPayableToman(method, toman, balance, useWalletBalance)

  const purchasePayload = {
    username: recipient.username,
    months,
    toman,
    recipientName: recipient.name,
    recipientPhoto: recipient.photo || undefined,
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

  const handleContinue = async () => {
    if (isSubmitting) return

    if (method === 'wallet' && walletInsufficient) {
      showNotification('موجودی کیف پول کافی نیست', 'warning')
      return
    }

    haptic('light')

    if (!isUserKycVerified(user)) {
      const kycPath = getKycNextPath(user)
      if (kycPath) {
        navigate(kycPath, {
          state: {
            product: 'premium' as const,
            ...confirmState,
            method,
          },
        })
        return
      }
    }

    setIsSubmitting(true)

    try {
      if (method === 'wallet') {
        const response = await purchasePremiumWithWallet(purchasePayload)
        await refetch({ silent: true })
        navigate(`/premium/payment/success?orderId=${encodeURIComponent(response.orderId)}`, {
          replace: true,
        })
        return
      }

      const response = await purchasePremiumWithGateway({
        ...purchasePayload,
        useWalletBalance: useWalletBalance && balance > 0 && balance < toman,
      })

      if (!response.paymentUrl) {
        await refetch({ silent: true })
        navigate(`/premium/payment/success?orderId=${encodeURIComponent(response.orderId)}`, {
          replace: true,
        })
        return
      }

      await refetch({ silent: true })
      openPaymentUrl(response.paymentUrl)
    } catch (error) {
      showNotification(error instanceof Error ? error.message : 'خطا در ثبت خرید', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const continueDisabled = isSubmitting || (method === 'wallet' && walletInsufficient)

  const continueLabel = isSubmitting
    ? method === 'wallet'
      ? 'در حال پردازش...'
      : 'در حال انتقال به درگاه...'
    : 'ادامه'

  return (
    <div className="premium-confirm">
      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={hideNotification}
      />

      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title="تأیید خرید پریمیوم" onBack={handleBack} />
      </div>

      <div className="premium-confirm__content">
        <h2
          className="premium-confirm__section-title shop-rise"
          style={{ '--rise-index': 1 } as CSSProperties}
        >
          دریافت‌کننده
        </h2>

        <div
          className="premium-confirm__recipient shop-rise"
          style={{ '--rise-index': 2 } as CSSProperties}
          aria-label="دریافت‌کننده"
        >
          <span className="premium-confirm__recipient-avatar">
            {recipient.photo ? (
              <img src={recipient.photo} alt="" />
            ) : (
              recipient.name.charAt(0)
            )}
          </span>
          <div className="premium-confirm__recipient-meta">
            <span className="premium-confirm__recipient-name">{recipient.name}</span>
            <span className="premium-confirm__recipient-sep" aria-hidden>
              |
            </span>
            <span className="premium-confirm__recipient-username" dir="ltr">
              @{recipient.username}
            </span>
          </div>
        </div>

        <section
          className="premium-confirm__summary shop-rise"
          style={{ '--rise-index': 3 } as CSSProperties}
          aria-label="مبلغ قابل پرداخت"
        >
          <span className="premium-confirm__summary-label">مبلغ قابل پرداخت</span>
          <div className="premium-confirm__summary-value-row">
            <span className="premium-confirm__summary-unit">تومان</span>
            <span className="premium-confirm__summary-value">
              {payableToman.toLocaleString('fa-IR')}
            </span>
          </div>
          <div className="premium-confirm__plan-row">
            <img
              src="/premium-star.svg"
              alt=""
              className="premium-confirm__mini-star"
              width={14}
              height={14}
            />
            <span>پریمیوم {PREMIUM_PLAN_LABELS[months]}</span>
          </div>
        </section>

        <h2
          className="premium-confirm__section-title shop-rise"
          style={{ '--rise-index': 4 } as CSSProperties}
        >
          روش پرداخت
        </h2>

        <div className="shop-rise" style={{ '--rise-index': 5 } as CSSProperties}>
          <ConfirmPaymentMethods
            method={method}
            onMethodChange={(next) => {
              setMethod(next)
              if (next !== 'zibal') setUseWalletBalance(false)
            }}
            balance={balance}
            toman={toman}
            useWalletBalance={useWalletBalance}
            onUseWalletBalanceChange={setUseWalletBalance}
            walletInsufficient={walletInsufficient}
            onHaptic={() => haptic('light')}
            accent="#925cff"
          />
        </div>
      </div>

      <footer
        className="premium-confirm__footer shop-rise"
        style={{ '--rise-index': 6 } as CSSProperties}
      >
        <button
          type="button"
          className="premium-confirm__continue"
          disabled={continueDisabled}
          onClick={() => void handleContinue()}
        >
          {continueLabel}
        </button>
      </footer>
    </div>
  )
}
