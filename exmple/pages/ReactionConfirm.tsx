import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ConfirmPaymentMethods,
  getConfirmPayableToman,
  getDefaultConfirmPaymentMethod,
} from '../components/ConfirmPaymentMethods'
import { EmojiGlyph } from '../components/EmojiGlyph'
import { Notification } from '../components/Notification'
import { PageHeader } from '../components/PageHeader'
import { useUser } from '../context/UserContext'
import { useTelegram } from '../hooks/useTelegram'
import { balanceToToman, isTelegramWebApp } from '../lib/api'
import { getKycNextPath, isUserKycVerified } from '../lib/kyc'
import { openPaymentUrl } from '../lib/payments'
import {
  purchaseReactionWithGateway,
  purchaseReactionWithWallet,
} from '../lib/reaction'
import {
  type ReactionConfirmState,
  type ReactionPaymentMethod,
} from '../types/reaction'
import '../styles/shop-rise.css'
import './ReactionConfirm.css'

function isValidConfirmState(state: ReactionConfirmState | null): state is ReactionConfirmState {
  if (!state?.post?.link || !state.post.title) return false
  if (!Array.isArray(state.reactions) || state.reactions.length === 0) return false
  if (
    !state.reactions.every(
      (item) =>
        Number.isFinite(item.serviceId) &&
        Number.isFinite(item.quantity) &&
        item.quantity >= item.min &&
        item.quantity <= item.max &&
        item.emoji,
    )
  ) {
    return false
  }
  if (!Number.isFinite(state.toman) || state.toman <= 0) return false
  return true
}

export function ReactionConfirmPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, refetch } = useUser()
  const { haptic } = useTelegram()
  const confirmState = location.state as ReactionConfirmState | null
  const balance = user ? balanceToToman(user.balance) : 0

  const [method, setMethod] = useState<ReactionPaymentMethod>(() =>
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
      navigate('/reaction', { replace: true })
      return
    }

    const selectedCounts = Object.fromEntries(
      confirmState.reactions.map((item) => [item.serviceId, item.quantity]),
    )

    navigate('/reaction', {
      replace: true,
      state: {
        post: confirmState.post,
        selectedCounts,
      },
    })
  }, [confirmState, navigate])

  useEffect(() => {
    if (isValidConfirmState(confirmState)) return
    navigate('/reaction', { replace: true })
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

  const { post, reactions, toman } = confirmState
  const totalReactions = reactions.reduce((sum, item) => sum + item.quantity, 0)
  const payableToman = getConfirmPayableToman(method, toman, balance, useWalletBalance)

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
            product: 'reaction' as const,
            ...confirmState,
            method,
          },
        })
        return
      }
    }

    setIsSubmitting(true)

    const payload = {
      post: {
        username: post.username,
        messageId: post.messageId,
        link: post.link,
        title: post.title,
        preview: post.preview,
        photo: post.photo,
      },
      reactions: reactions.map((item) => ({
        serviceId: item.serviceId,
        emoji: item.emoji,
        quantity: item.quantity,
        rate: item.rate,
      })),
      toman,
    }

    try {
      if (method === 'wallet') {
        const response = await purchaseReactionWithWallet(payload)
        await refetch({ silent: true })
        navigate(
          `/reaction/payment/success?orderId=${encodeURIComponent(response.orderId)}`,
          { replace: true },
        )
        return
      }

      const response = await purchaseReactionWithGateway({
        ...payload,
        useWalletBalance: useWalletBalance && balance > 0 && balance < toman,
      })

      if (!response.paymentUrl) {
        await refetch({ silent: true })
        navigate(
          `/reaction/payment/success?orderId=${encodeURIComponent(response.orderId)}`,
          { replace: true },
        )
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
    <div className="reaction-confirm">
      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={hideNotification}
      />

      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title="تأیید خرید ری‌اکشن" onBack={handleBack} />
      </div>

      <div className="reaction-confirm__content">
        <h2
          className="reaction-confirm__section-title shop-rise"
          style={{ '--rise-index': 1 } as CSSProperties}
        >
          پست انتخاب‌شده
        </h2>

        <div
          className="reaction-confirm__post shop-rise"
          style={{ '--rise-index': 2 } as CSSProperties}
          aria-label="پست انتخاب‌شده"
        >
          <span className="reaction-confirm__post-avatar">
            {post.photo ? <img src={post.photo} alt="" /> : post.title.charAt(0)}
          </span>
          <div className="reaction-confirm__post-meta">
            <span className="reaction-confirm__post-name">{post.title}</span>
            {post.preview ? (
              <>
                <span className="reaction-confirm__post-sep" aria-hidden>
                  |
                </span>
                <span className="reaction-confirm__post-preview">{post.preview}</span>
              </>
            ) : null}
          </div>
        </div>

        <h2
          className="reaction-confirm__section-title shop-rise"
          style={{ '--rise-index': 3 } as CSSProperties}
        >
          ری‌اکشن‌های انتخابی
        </h2>

        <div
          className="reaction-confirm__reactions shop-rise"
          style={{ '--rise-index': 4 } as CSSProperties}
          aria-label="ری‌اکشن‌های انتخابی"
        >
          {reactions.map((item) => (
            <div key={item.serviceId} className="reaction-confirm__emoji-btn" aria-label={`${item.emoji}، ${item.quantity}`}>
              <span className="reaction-confirm__emoji-glyph" aria-hidden>
                <EmojiGlyph emoji={item.emoji} size={20} />
              </span>
              <span className="reaction-confirm__emoji-count">
                {item.quantity.toLocaleString('fa-IR')}
              </span>
            </div>
          ))}
        </div>

        <section
          className="reaction-confirm__summary shop-rise"
          style={{ '--rise-index': 5 } as CSSProperties}
          aria-label="مبلغ قابل پرداخت"
        >
          <span className="reaction-confirm__summary-label">مبلغ قابل پرداخت</span>
          <div className="reaction-confirm__summary-value-row">
            <span className="reaction-confirm__summary-unit">تومان</span>
            <span className="reaction-confirm__summary-value">
              {payableToman.toLocaleString('fa-IR')}
            </span>
          </div>
          <div className="reaction-confirm__summary-chip">
            {totalReactions.toLocaleString('fa-IR')} ری‌اکشن
          </div>
        </section>

        <h2
          className="reaction-confirm__section-title shop-rise"
          style={{ '--rise-index': 6 } as CSSProperties}
        >
          روش پرداخت
        </h2>

        <div className="shop-rise" style={{ '--rise-index': 7 } as CSSProperties}>
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
            accent="#f43f5e"
          />
        </div>
      </div>

      <footer
        className="reaction-confirm__footer shop-rise"
        style={{ '--rise-index': 8 } as CSSProperties}
      >
        <button
          type="button"
          className="reaction-confirm__continue"
          disabled={continueDisabled}
          onClick={() => void handleContinue()}
        >
          {continueLabel}
        </button>
      </footer>
    </div>
  )
}
