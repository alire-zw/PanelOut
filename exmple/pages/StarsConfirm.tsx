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
import { openPaymentUrl } from '../lib/payments'
import { getStarsKycNextPath, isUserKycVerified } from '../lib/kyc'
import {
  purchaseStarsWithGateway,
  purchaseStarsWithWallet,
} from '../lib/stars'
import type { StarsConfirmState, StarsPaymentMethod } from '../types/stars'
import '../styles/shop-rise.css'
import './StarsConfirm.css'

const MIN_STARS = 50
const MAX_STARS = 1_000_000

function isValidConfirmState(state: StarsConfirmState | null): state is StarsConfirmState {
  if (!state?.recipient) return false
  if (!Number.isFinite(state.stars) || state.stars < MIN_STARS || state.stars > MAX_STARS) {
    return false
  }
  if (!Number.isFinite(state.toman) || state.toman <= 0) return false
  return true
}

export function StarsConfirmPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, refetch } = useUser()
  const { haptic } = useTelegram()
  const confirmState = location.state as StarsConfirmState | null
  const balance = user ? balanceToToman(user.balance) : 0

  const [method, setMethod] = useState<StarsPaymentMethod>(() =>
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
      navigate('/stars', { replace: true })
      return
    }

    navigate('/stars', {
      replace: true,
      state: {
        recipient: confirmState.recipient,
        customAmount: String(confirmState.stars),
      },
    })
  }, [confirmState, navigate])

  useEffect(() => {
    if (isValidConfirmState(confirmState)) return
    navigate('/stars', { replace: true })
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

  const { recipient, stars, toman } = confirmState
  const payableToman = getConfirmPayableToman(method, toman, balance, useWalletBalance)

  const purchasePayload = {
    username: recipient.username,
    quantity: stars,
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
      const kycPath = getStarsKycNextPath(user)
      if (kycPath) {
        navigate(kycPath, {
          state: {
            product: 'stars' as const,
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
        const response = await purchaseStarsWithWallet(purchasePayload)
        await refetch({ silent: true })
        navigate(`/stars/payment/success?orderId=${encodeURIComponent(response.orderId)}`, {
          replace: true,
        })
        return
      }

      const response = await purchaseStarsWithGateway({
        ...purchasePayload,
        useWalletBalance: useWalletBalance && balance > 0 && balance < toman,
      })

      if (!response.paymentUrl) {
        await refetch({ silent: true })
        navigate(`/stars/payment/success?orderId=${encodeURIComponent(response.orderId)}`, {
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

  const continueDisabled =
    isSubmitting || (method === 'wallet' && walletInsufficient)

  const continueLabel = isSubmitting
    ? method === 'wallet'
      ? 'در حال پردازش...'
      : 'در حال انتقال به درگاه...'
    : 'ادامه'

  return (
    <div className="stars-confirm">
      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={hideNotification}
      />

      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title="تأیید خرید استارز" onBack={handleBack} />
      </div>

      <div className="stars-confirm__content">
        <h2
          className="stars-confirm__section-title shop-rise"
          style={{ '--rise-index': 1 } as CSSProperties}
        >
          دریافت‌کننده
        </h2>

        <div
          className="stars-confirm__recipient shop-rise"
          style={{ '--rise-index': 2 } as CSSProperties}
          aria-label="دریافت‌کننده"
        >
          <span className="stars-confirm__recipient-avatar">
            {recipient.photo ? (
              <img src={recipient.photo} alt="" />
            ) : (
              recipient.name.charAt(0)
            )}
          </span>
          <div className="stars-confirm__recipient-meta">
            <span className="stars-confirm__recipient-name">{recipient.name}</span>
            <span className="stars-confirm__recipient-sep" aria-hidden>
              |
            </span>
            <span className="stars-confirm__recipient-username" dir="ltr">
              @{recipient.username}
            </span>
          </div>
        </div>

        <section
          className="stars-confirm__summary shop-rise"
          style={{ '--rise-index': 3 } as CSSProperties}
          aria-label="مبلغ قابل پرداخت"
        >
          <span className="stars-confirm__summary-label">مبلغ قابل پرداخت</span>
          <div className="stars-confirm__summary-value-row">
            <span className="stars-confirm__summary-unit">تومان</span>
            <span className="stars-confirm__summary-value">
              {payableToman.toLocaleString('fa-IR')}
            </span>
          </div>
          <div className="stars-confirm__stars-row">
            <img src="/star.svg" alt="" className="stars-confirm__mini-star" width={14} height={14} />
            <span>{stars.toLocaleString('fa-IR')} استارز</span>
          </div>
        </section>

        <h2
          className="stars-confirm__section-title shop-rise"
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
            accent="#ffb922"
          />
        </div>
      </div>

      <footer
        className="stars-confirm__footer shop-rise"
        style={{ '--rise-index': 6 } as CSSProperties}
      >
        <button
          type="button"
          className="stars-confirm__continue"
          disabled={continueDisabled}
          onClick={() => void handleContinue()}
        >
          {continueLabel}
        </button>
      </footer>
    </div>
  )
}
