import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ConfirmPaymentMethods,
  getConfirmPayableToman,
  getDefaultConfirmPaymentMethod,
} from '../components/ConfirmPaymentMethods'
import { Notification } from '../components/Notification'
import { PageHeader } from '../components/PageHeader'
import { CHANNEL_VIEW_SERVICE } from '../data/channelViews'
import { useUser } from '../context/UserContext'
import { useTelegram } from '../hooks/useTelegram'
import { useShopPricingRule } from '../hooks/useShopPricing'
import { balanceToToman, isTelegramWebApp } from '../lib/api'
import {
  purchaseChannelViewsWithGateway,
  purchaseChannelViewsWithWallet,
} from '../lib/channelViews'
import { getKycNextPath, isUserKycVerified } from '../lib/kyc'
import { openPaymentUrl } from '../lib/payments'
import { applyPricingRule, type ShopPricingRule } from '../lib/productPricing'
import {
  calcChannelViewsToman,
  type ChannelViewsConfirmState,
  type ChannelViewsPaymentMethod,
} from '../types/channelViews'
import '../styles/shop-rise.css'
import './ChannelViewsConfirm.css'

function isValidConfirmState(
  state: ChannelViewsConfirmState | null,
  rule: ShopPricingRule | null,
): state is ChannelViewsConfirmState {
  if (!state?.post?.link || !state.post.title) return false
  if (state.serviceId !== CHANNEL_VIEW_SERVICE.serviceId) return false
  if (
    !Number.isFinite(state.quantity) ||
    state.quantity < CHANNEL_VIEW_SERVICE.min ||
    state.quantity > CHANNEL_VIEW_SERVICE.max
  ) {
    return false
  }
  if (!Number.isFinite(state.rate) || state.rate <= 0) return false
  if (!Number.isFinite(state.toman) || state.toman <= 0) return false
  const base = calcChannelViewsToman(state.quantity, state.rate)
  if (applyPricingRule(base, rule) !== state.toman) return false
  return true
}

export function ChannelViewsConfirmPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, refetch } = useUser()
  const { haptic } = useTelegram()
  const confirmState = location.state as ChannelViewsConfirmState | null
  const balance = user ? balanceToToman(user.balance) : 0
  const pricingRule = useShopPricingRule('channel-views')
  const pricingReady = pricingRule !== undefined

  const [method, setMethod] = useState<ChannelViewsPaymentMethod>(() =>
    getDefaultConfirmPaymentMethod(balance, confirmState?.toman ?? 0),
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
    if (!pricingReady || !isValidConfirmState(confirmState, pricingRule)) return
    if (balance < confirmState.toman) {
      setMethod('zibal')
      setUseWalletBalance(false)
    }
  }, [balance, confirmState, pricingReady, pricingRule])

  const handleBack = useCallback(() => {
    if (!pricingReady || !isValidConfirmState(confirmState, pricingRule)) {
      navigate('/channel-views', { replace: true })
      return
    }

    navigate('/channel-views', {
      replace: true,
      state: {
        post: confirmState.post,
        quantity: String(confirmState.quantity),
      },
    })
  }, [confirmState, navigate, pricingReady, pricingRule])

  useEffect(() => {
    if (!pricingReady) return
    if (isValidConfirmState(confirmState, pricingRule)) return
    navigate('/channel-views', { replace: true })
  }, [confirmState, navigate, pricingReady, pricingRule])

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
    if (!pricingReady || !isValidConfirmState(confirmState, pricingRule)) return false
    return balance < confirmState.toman
  }, [balance, confirmState, pricingReady, pricingRule])

  if (!pricingReady || !isValidConfirmState(confirmState, pricingRule)) {
    return null
  }

  const { post, quantity, rate, serviceId, toman } = confirmState
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
            product: 'channel-views' as const,
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
      serviceId,
      quantity,
      rate,
      toman,
    }

    try {
      if (method === 'wallet') {
        const response = await purchaseChannelViewsWithWallet(payload)
        await refetch({ silent: true })
        navigate(
          `/channel-views/payment/success?orderId=${encodeURIComponent(response.orderId)}`,
          { replace: true },
        )
        return
      }

      const response = await purchaseChannelViewsWithGateway({
        ...payload,
        useWalletBalance: useWalletBalance && balance > 0 && balance < toman,
      })

      if (!response.paymentUrl) {
        await refetch({ silent: true })
        navigate(
          `/channel-views/payment/success?orderId=${encodeURIComponent(response.orderId)}`,
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
    <div className="channel-views-confirm">
      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={hideNotification}
      />

      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title="تأیید خرید سین کانال" onBack={handleBack} />
      </div>

      <div className="channel-views-confirm__content">
        <h2
          className="channel-views-confirm__section-title shop-rise"
          style={{ '--rise-index': 1 } as CSSProperties}
        >
          پست انتخاب‌شده
        </h2>

        <div
          className="channel-views-confirm__post shop-rise"
          style={{ '--rise-index': 2 } as CSSProperties}
          aria-label="پست انتخاب‌شده"
        >
          <span className="channel-views-confirm__post-avatar">
            {post.photo ? <img src={post.photo} alt="" /> : post.title.charAt(0)}
          </span>
          <div className="channel-views-confirm__post-meta">
            <span className="channel-views-confirm__post-name">{post.title}</span>
            {post.preview ? (
              <>
                <span className="channel-views-confirm__post-sep" aria-hidden>
                  |
                </span>
                <span className="channel-views-confirm__post-preview">{post.preview}</span>
              </>
            ) : null}
          </div>
        </div>

        <section
          className="channel-views-confirm__summary shop-rise"
          style={{ '--rise-index': 3 } as CSSProperties}
          aria-label="مبلغ قابل پرداخت"
        >
          <span className="channel-views-confirm__summary-label">مبلغ قابل پرداخت</span>
          <div className="channel-views-confirm__summary-value-row">
            <span className="channel-views-confirm__summary-unit">تومان</span>
            <span className="channel-views-confirm__summary-value">
              {payableToman.toLocaleString('fa-IR')}
            </span>
          </div>
          <div className="channel-views-confirm__summary-chip">
            {quantity.toLocaleString('fa-IR')} بازدید
          </div>
        </section>

        <h2
          className="channel-views-confirm__section-title shop-rise"
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
            accent="#0ea5e9"
          />
        </div>
      </div>

      <footer
        className="channel-views-confirm__footer shop-rise"
        style={{ '--rise-index': 6 } as CSSProperties}
      >
        <button
          type="button"
          className="channel-views-confirm__continue"
          disabled={continueDisabled}
          onClick={() => void handleContinue()}
        >
          {continueLabel}
        </button>
      </footer>
    </div>
  )
}
