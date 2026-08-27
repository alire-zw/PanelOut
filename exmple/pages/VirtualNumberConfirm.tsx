import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CountryFlagImg } from '../components/CountryFlagImg'
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
import { warmCountryFlagCache } from '../lib/countryFlagCache'
import { getKycNextPath, isUserKycVerified } from '../lib/kyc'
import { openPaymentUrl } from '../lib/payments'
import {
  purchaseVirtualNumberWithGateway,
  purchaseVirtualNumberWithWallet,
} from '../lib/virtualNumber'
import {
  VIRTUAL_NUMBER_QUALITY_LABELS,
  type VirtualNumberConfirmState,
  type VirtualNumberPaymentMethod,
  type VirtualNumberQuality,
} from '../types/virtualNumber'
import '../styles/shop-rise.css'
import './VirtualNumberConfirm.css'

const VALID_QUALITIES: VirtualNumberQuality[] = ['economy', 'standard', 'premium']

function isValidConfirmState(
  state: VirtualNumberConfirmState | null,
): state is VirtualNumberConfirmState {
  if (!state) return false
  if (!state.countryId?.trim() || !state.country?.trim() || !state.flagCode?.trim()) {
    return false
  }
  if (!VALID_QUALITIES.includes(state.quality)) return false
  if (!Number.isFinite(state.toman) || state.toman <= 0) return false
  return true
}

export function VirtualNumberConfirmPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, refetch } = useUser()
  const { haptic } = useTelegram()
  const confirmState = location.state as VirtualNumberConfirmState | null
  const balance = user ? balanceToToman(user.balance) : 0

  const [method, setMethod] = useState<VirtualNumberPaymentMethod>(() =>
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
      navigate('/virtual-number', { replace: true })
      return
    }

    navigate('/virtual-number', {
      replace: true,
      state: {
        countryId: confirmState.countryId,
        quality: confirmState.quality,
      },
    })
  }, [confirmState, navigate])

  useEffect(() => {
    if (isValidConfirmState(confirmState)) return
    navigate('/virtual-number', { replace: true })
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

  useEffect(() => {
    if (!isValidConfirmState(confirmState)) return
    void warmCountryFlagCache([confirmState.flagCode])
  }, [confirmState])

  const walletInsufficient = useMemo(() => {
    if (!isValidConfirmState(confirmState)) return false
    return balance < confirmState.toman
  }, [balance, confirmState])

  if (!isValidConfirmState(confirmState)) {
    return null
  }

  const { country, countryId, flagCode, quality, toman } = confirmState
  const payableToman = getConfirmPayableToman(method, toman, balance, useWalletBalance)

  const purchasePayload = {
    countryId,
    country,
    flagCode,
    quality,
    toman,
    noneReport: true,
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
            product: 'virtual-number' as const,
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
        const response = await purchaseVirtualNumberWithWallet(purchasePayload)
        await refetch({ silent: true })
        navigate(
          `/virtual-number/payment/success?orderId=${encodeURIComponent(response.orderId)}`,
          { replace: true },
        )
        return
      }

      const response = await purchaseVirtualNumberWithGateway({
        ...purchasePayload,
        useWalletBalance: useWalletBalance && balance > 0 && balance < toman,
      })

      if (!response.paymentUrl) {
        await refetch({ silent: true })
        navigate(
          `/virtual-number/payment/success?orderId=${encodeURIComponent(response.orderId)}`,
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
    <div className="virtual-number-confirm">
      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={hideNotification}
      />

      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title="تأیید خرید شماره مجازی" onBack={handleBack} />
      </div>

      <div className="virtual-number-confirm__content">
        <h2
          className="virtual-number-confirm__section-title shop-rise"
          style={{ '--rise-index': 1 } as CSSProperties}
        >
          کشور انتخاب‌شده
        </h2>

        <div
          className="virtual-number-confirm__country shop-rise"
          style={{ '--rise-index': 2 } as CSSProperties}
          aria-label="کشور انتخاب‌شده"
        >
          <span className="virtual-number-confirm__country-start">
            <CountryFlagImg
              flagCode={flagCode}
              className="virtual-number-confirm__country-flag"
              width={24}
              height={18}
            />
            <span className="virtual-number-confirm__country-name">{country}</span>
          </span>
          <span className="virtual-number-confirm__country-quality">
            کیفیت {VIRTUAL_NUMBER_QUALITY_LABELS[quality]}
          </span>
        </div>

        <section
          className="virtual-number-confirm__summary shop-rise"
          style={{ '--rise-index': 3 } as CSSProperties}
          aria-label="مبلغ قابل پرداخت"
        >
          <span className="virtual-number-confirm__summary-label">مبلغ قابل پرداخت</span>
          <div className="virtual-number-confirm__summary-value-row">
            <span className="virtual-number-confirm__summary-unit">تومان</span>
            <span className="virtual-number-confirm__summary-value">
              {payableToman.toLocaleString('fa-IR')}
            </span>
          </div>
        </section>

        <h2
          className="virtual-number-confirm__section-title shop-rise"
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
            accent="#10b981"
          />
        </div>
      </div>

      <footer
        className="virtual-number-confirm__footer shop-rise"
        style={{ '--rise-index': 6 } as CSSProperties}
      >
        <button
          type="button"
          className="virtual-number-confirm__continue"
          disabled={continueDisabled}
          onClick={() => void handleContinue()}
        >
          {continueLabel}
        </button>
      </footer>
    </div>
  )
}
