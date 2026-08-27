import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ConfirmPaymentMethods,
  getConfirmPayableToman,
  getDefaultConfirmPaymentMethod,
} from '../components/ConfirmPaymentMethods'
import { Notification } from '../components/Notification'
import { PageHeader } from '../components/PageHeader'
import { TelegramMemberServiceStats } from '../components/TelegramMemberServiceStats'
import { useUser } from '../context/UserContext'
import { useTelegram } from '../hooks/useTelegram'
import { useShopPricingRule } from '../hooks/useShopPricing'
import { balanceToToman, isTelegramWebApp } from '../lib/api'
import { getKycNextPath, isUserKycVerified } from '../lib/kyc'
import { openPaymentUrl } from '../lib/payments'
import { applyPricingRule, type ShopPricingRule } from '../lib/productPricing'
import {
  purchaseTelegramMembersWithGateway,
  purchaseTelegramMembersWithWallet,
} from '../lib/telegramMembers'
import {
  calcTelegramMembersToman,
  findTelegramMemberService,
  type TelegramMembersConfirmState,
} from '../types/telegramMembers'
import '../styles/shop-rise.css'
import './TelegramMembersConfirm.css'

type PaymentMethod = 'wallet' | 'zibal'

function formatChannelSubscribers(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''

  const normalizedDigits = trimmed.replace(/[۰-۹]/g, (digit) =>
    String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)),
  )
  const digitsOnly = normalizedDigits.replace(/[^\d]/g, '')
  if (digitsOnly) {
    const count = Number(digitsOnly)
    if (Number.isFinite(count) && count > 0) {
      return `${count.toLocaleString('fa-IR')} عضو`
    }
  }

  return trimmed
    .replace(/\bsubscribers?\b/gi, 'عضو')
    .replace(/\bmembers?\b/gi, 'عضو')
    .replace(/\bonline\b/gi, 'آنلاین')
}

function isValidConfirmState(
  state: TelegramMembersConfirmState | null,
  rule: ShopPricingRule | null,
): state is TelegramMembersConfirmState {
  if (!state?.channel?.link || !state.channel.title) return false
  if (!state.service?.serviceId) return false
  const catalog = findTelegramMemberService(state.service.serviceId)
  if (!catalog) return false
  if (
    !Number.isFinite(state.quantity) ||
    state.quantity < catalog.min ||
    state.quantity > catalog.max
  ) {
    return false
  }
  if (!Number.isFinite(state.toman) || state.toman <= 0) return false
  const base = calcTelegramMembersToman(state.quantity, catalog.rate)
  if (applyPricingRule(base, rule) !== state.toman) return false
  return true
}

export function TelegramMembersConfirmPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, refetch } = useUser()
  const { haptic } = useTelegram()
  const confirmState = location.state as TelegramMembersConfirmState | null
  const balance = user ? balanceToToman(user.balance) : 0
  const pricingRule = useShopPricingRule('telegram-members')
  const pricingReady = pricingRule !== undefined

  const [method, setMethod] = useState<PaymentMethod>(() =>
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
      navigate('/telegram-members', { replace: true })
      return
    }

    navigate('/telegram-members', {
      replace: true,
      state: {
        channel: confirmState.channel,
        serviceId: confirmState.service.serviceId,
        quantity: String(confirmState.quantity),
      },
    })
  }, [confirmState, navigate, pricingReady, pricingRule])

  useEffect(() => {
    if (!pricingReady) return
    if (isValidConfirmState(confirmState, pricingRule)) return
    navigate('/telegram-members', { replace: true })
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

  const { channel, service, quantity, toman } = confirmState
  const catalog = findTelegramMemberService(service.serviceId) ?? service
  const channelPreview = channel.subscribers
    ? formatChannelSubscribers(channel.subscribers)
    : `@${channel.username}`
  const payableToman = getConfirmPayableToman(method, toman, balance, useWalletBalance)

  const showNotification = (
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'error',
  ) => {
    setNotification({ show: true, message, type })
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
            product: 'telegram-members' as const,
            ...confirmState,
            method,
          },
        })
        return
      }
    }

    setIsSubmitting(true)

    const payload = {
      channel: {
        username: channel.username,
        link: channel.link,
        title: channel.title,
        photo: channel.photo,
        subscribers: channel.subscribers,
      },
      serviceId: catalog.serviceId,
      quantity,
      rate: catalog.rate,
      toman,
    }

    try {
      if (method === 'wallet') {
        const response = await purchaseTelegramMembersWithWallet(payload)
        await refetch({ silent: true })
        navigate(
          `/telegram-members/payment/success?orderId=${encodeURIComponent(response.orderId)}`,
          { replace: true },
        )
        return
      }

      const response = await purchaseTelegramMembersWithGateway({
        ...payload,
        useWalletBalance: useWalletBalance && balance > 0 && balance < toman,
      })

      if (!response.paymentUrl) {
        await refetch({ silent: true })
        navigate(
          `/telegram-members/payment/success?orderId=${encodeURIComponent(response.orderId)}`,
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
    <div className="telegram-members-confirm">
      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification((prev) => ({ ...prev, show: false }))}
      />

      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title="تأیید خرید ممبر" onBack={handleBack} />
      </div>

      <div className="telegram-members-confirm__content">
        <section className="telegram-members-confirm__section shop-rise" style={{ '--rise-index': 1 } as CSSProperties}>
          <h2 className="telegram-members-confirm__section-title">کانال انتخاب‌شده</h2>
          <div className="telegram-members-confirm__channel">
            <div className="telegram-members-confirm__channel-info">
              <span className="telegram-members-confirm__channel-name">{channel.title}</span>
              <span className="telegram-members-confirm__channel-sep" aria-hidden>
                |
              </span>
              <span
                className="telegram-members-confirm__channel-preview"
                dir={channel.subscribers ? undefined : 'ltr'}
              >
                {channelPreview}
              </span>
            </div>
            <span className="telegram-members-confirm__avatar">
              {channel.photo ? (
                <img src={channel.photo} alt="" />
              ) : (
                channel.title.charAt(0)
              )}
            </span>
          </div>
        </section>

        <section className="telegram-members-confirm__section shop-rise" style={{ '--rise-index': 2 } as CSSProperties}>
          <h2 className="telegram-members-confirm__section-title">نوع ممبر</h2>
          <div className="telegram-members-confirm__service">
            <span className="telegram-members-confirm__service-name">{catalog.name}</span>
            <span className="telegram-members-confirm__service-desc">{catalog.shortDesc}</span>
            <TelegramMemberServiceStats
              rate={catalog.rate}
              min={catalog.min}
              max={catalog.max}
              compact
            />
          </div>
        </section>

        <section
          className="telegram-members-confirm__summary shop-rise"
          style={{ '--rise-index': 3 } as CSSProperties}
          aria-label="مبلغ قابل پرداخت"
        >
          <span className="telegram-members-confirm__summary-label">مبلغ قابل پرداخت</span>
          <div className="telegram-members-confirm__summary-value-row">
            <span className="telegram-members-confirm__summary-unit">تومان</span>
            <span className="telegram-members-confirm__summary-value">
              {payableToman.toLocaleString('fa-IR')}
            </span>
          </div>
          <div className="telegram-members-confirm__summary-meta">
            <span className="telegram-members-confirm__summary-chip">
              {quantity.toLocaleString('fa-IR')} ممبر
            </span>
            <span className="telegram-members-confirm__summary-chip telegram-members-confirm__summary-chip--soft">
              {catalog.rate.toLocaleString('fa-IR')} تومان به ازای ۱۰۰۰ عدد
            </span>
          </div>
        </section>

        <section className="telegram-members-confirm__section shop-rise" style={{ '--rise-index': 4 } as CSSProperties}>
          <h2 className="telegram-members-confirm__section-title">روش پرداخت</h2>
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
            accent="#229ed9"
          />
        </section>
      </div>

      <footer
        className="telegram-members-confirm__footer shop-rise"
        style={{ '--rise-index': 5 } as CSSProperties}
      >
        <button
          type="button"
          className="telegram-members-confirm__continue"
          disabled={continueDisabled}
          onClick={() => {
            void handleContinue()
          }}
        >
          {continueLabel}
        </button>
      </footer>
    </div>
  )
}
