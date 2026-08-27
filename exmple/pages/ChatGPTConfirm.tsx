import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ConfirmPaymentMethods,
  getConfirmPayableToman,
  getDefaultConfirmPaymentMethod,
} from '../components/ConfirmPaymentMethods'
import { AccountShopPlanStats } from '../components/AccountShopPlanStats'
import { Notification } from '../components/Notification'
import { PageHeader } from '../components/PageHeader'
import { useUser } from '../context/UserContext'
import { accountShopRoute } from '../data/accountShopProducts'
import { useTelegram } from '../hooks/useTelegram'
import { balanceToToman, isTelegramWebApp } from '../lib/api'
import {
  purchaseAccountShopWithGateway,
  purchaseAccountShopWithWallet,
} from '../lib/chatgpt'
import { getKycNextPath, isUserKycVerified } from '../lib/kyc'
import { openPaymentUrl } from '../lib/payments'
import type {
  AccountShopConfirmState,
  AccountShopPaymentMethod,
  AccountShopProductsRestoreState,
} from '../types/accountShop'
import '../styles/shop-rise.css'
import './ChatGPTConfirm.css'

function isValidConfirmState(state: AccountShopConfirmState | null): state is AccountShopConfirmState {
  if (!state?.product?.productId) return false
  if (!state.categoryId || !state.categoryLabel) return false
  if (!Number.isFinite(state.toman) || state.toman <= 0) return false
  if (!state.fieldValues || typeof state.fieldValues !== 'object') return false

  const planId = state.product.planId ?? Number(state.product.productId)
  if (!Number.isFinite(planId) || planId <= 0) return false

  for (const field of state.product.customFields ?? []) {
    if (!field.required) continue
    if (!(state.fieldValues[field.id] ?? '').trim()) return false
  }
  return true
}

export function ChatGPTConfirmPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, refetch } = useUser()
  const { haptic } = useTelegram()
  const confirmState = location.state as AccountShopConfirmState | null
  const balance = user ? balanceToToman(user.balance) : 0

  const [method, setMethod] = useState<AccountShopPaymentMethod>(() =>
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
      navigate('/chatgpt', { replace: true })
      return
    }

    const restore: AccountShopProductsRestoreState = {
      categoryId: confirmState.categoryId,
      productId: confirmState.product.productId,
      fieldValues: confirmState.fieldValues,
    }

    navigate(accountShopRoute(confirmState.categoryId), { replace: true, state: restore })
  }, [confirmState, navigate])

  useEffect(() => {
    if (isValidConfirmState(confirmState)) return
    navigate('/chatgpt', { replace: true })
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

  const { product, categoryId, categoryLabel, categoryImageSrc, fieldValues, toman } = confirmState
  const planId = product.planId ?? Number(product.productId)
  const payableToman = getConfirmPayableToman(method, toman, balance, useWalletBalance)
  const filledFields = (product.customFields ?? []).filter(
    (field) => (fieldValues[field.id] ?? '').trim().length > 0,
  )

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
            product: 'account-shop' as const,
            categoryId: confirmState.categoryId,
            categoryLabel: confirmState.categoryLabel,
            categoryImageSrc: confirmState.categoryImageSrc,
            plan: confirmState.product,
            fieldValues: confirmState.fieldValues,
            toman: confirmState.toman,
            method,
          },
        })
        return
      }
    }

    setIsSubmitting(true)

    const payload = {
      planId,
      categoryId,
      toman,
      fieldValues,
    }

    try {
      if (method === 'wallet') {
        const response = await purchaseAccountShopWithWallet(payload)
        await refetch({ silent: true })
        navigate(`/chatgpt/payment/success?orderId=${encodeURIComponent(response.orderId)}`, {
          replace: true,
        })
        return
      }

      const response = await purchaseAccountShopWithGateway({
        ...payload,
        useWalletBalance: useWalletBalance && balance > 0 && balance < toman,
      })

      if (!response.paymentUrl) {
        await refetch({ silent: true })
        navigate(`/chatgpt/payment/success?orderId=${encodeURIComponent(response.orderId)}`, {
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
    <div className="account-shop-confirm">
      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification((prev) => ({ ...prev, show: false }))}
      />

      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title="تأیید خرید اکانت" onBack={handleBack} />
      </div>

      <div className="account-shop-confirm__content">
        <h2
          className="account-shop-confirm__section-title shop-rise"
          style={{ '--rise-index': 1 } as CSSProperties}
        >
          محصول
        </h2>

        <div
          className="account-shop-confirm__product shop-rise"
          style={{ '--rise-index': 2 } as CSSProperties}
          aria-label="محصول انتخاب‌شده"
        >
          <span className="account-shop-confirm__product-thumb" aria-hidden>
            {categoryImageSrc ? (
              <img src={categoryImageSrc} alt="" width={36} height={36} />
            ) : (
              <span>{categoryLabel.charAt(0)}</span>
            )}
          </span>
          <div className="account-shop-confirm__product-meta">
            <span className="account-shop-confirm__product-name">{product.name}</span>
            <span className="account-shop-confirm__product-sub">{categoryLabel}</span>
            <AccountShopPlanStats
              toman={product.toman}
              durationLabel={product.durationLabel}
              warrantyLabel={product.warrantyLabel}
              compact
            />
            {filledFields.length > 0 ? (
              <div className="account-shop-confirm__fields" aria-label="اطلاعات سفارش">
                {filledFields.map((field) => (
                  <div key={field.id} className="account-shop-confirm__field-row">
                    <span className="account-shop-confirm__field-label">{field.label}</span>
                    <span className="account-shop-confirm__field-value" dir="auto">
                      {fieldValues[field.id]}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <section
          className="account-shop-confirm__summary shop-rise"
          style={{ '--rise-index': 3 } as CSSProperties}
          aria-label="مبلغ قابل پرداخت"
        >
          <span className="account-shop-confirm__summary-label">مبلغ قابل پرداخت</span>
          <div className="account-shop-confirm__summary-value-row">
            <span className="account-shop-confirm__summary-unit">تومان</span>
            <span className="account-shop-confirm__summary-value">
              {payableToman.toLocaleString('fa-IR')}
            </span>
          </div>
        </section>

        <h2
          className="account-shop-confirm__section-title shop-rise"
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
            accent="#10a37f"
          />
        </div>
      </div>

      <footer
        className="account-shop-confirm__footer shop-rise"
        style={{ '--rise-index': 6 } as CSSProperties}
      >
        <button
          type="button"
          className="account-shop-confirm__continue"
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
