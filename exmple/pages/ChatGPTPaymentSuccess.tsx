import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import SuccessIcon from '../components/icons/SuccessIcon'
import { ACCOUNT_SHOP_CATEGORY_OPTIONS } from '../data/accountShopCategories'
import { useTelegram } from '../hooks/useTelegram'
import { isTelegramWebApp } from '../lib/api'
import { fetchOrder, type ShopOrder } from '../lib/orders'
import '../styles/shop-rise.css'
import './WalletPaymentResult.css'
import './ChatGPTPaymentResult.css'

function formatToman(value: string | number): string {
  const amount = typeof value === 'string' ? Number.parseInt(value, 10) : value
  if (!Number.isFinite(amount)) return '۰'
  return amount.toLocaleString('fa-IR')
}

function accountCategoryLabel(categoryId: string): string {
  return ACCOUNT_SHOP_CATEGORY_OPTIONS.find((item) => item.id === categoryId)?.label ?? categoryId
}

export function ChatGPTPaymentSuccessPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const orderId = searchParams.get('orderId')
  const { haptic } = useTelegram()
  const [order, setOrder] = useState<ShopOrder | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(orderId))

  const handleBack = useCallback(() => {
    navigate('/', { replace: true })
  }, [navigate])

  useEffect(() => {
    haptic('medium')
  }, [haptic])

  useEffect(() => {
    let cancelled = false

    const loadOrder = async () => {
      if (!orderId) {
        setIsLoading(false)
        return
      }

      setIsLoading(true)

      try {
        const response = await fetchOrder(orderId)
        if (!cancelled) {
          setOrder(response.order)
        }
      } catch {
        if (!cancelled) {
          setOrder(null)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadOrder()

    return () => {
      cancelled = true
    }
  }, [orderId])

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

  const accountOrder = order?.accountShopOrder ?? null
  const filledFields = accountOrder
    ? accountOrder.customFields.filter(
        (field) => (accountOrder.fieldValues[field.id] ?? '').trim().length > 0,
      )
    : []

  return (
    <div className="wallet-payment-result wallet-payment-result--success wallet-payment-result--chatgpt">
      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title="خرید موفق" onBack={handleBack} />
      </div>

      <div className="wallet-payment-result__content">
        <section
          className="wallet-payment-result__hero shop-rise"
          style={{ '--rise-index': 1 } as CSSProperties}
        >
          <div className="wallet-payment-result__icon wallet-payment-result__icon--success">
            <SuccessIcon width={34} height={34} />
          </div>
          <h2 className="wallet-payment-result__title">سفارش اکانت با موفقیت ثبت شد</h2>
          <p className="wallet-payment-result__subtitle">
            سفارش شما دریافت شد و در انتظار تأیید کارشناس می‌باشد.
          </p>
        </section>

        <section
          className="wallet-payment-result__card shop-rise"
          style={{ '--rise-index': 2 } as CSSProperties}
          aria-label="جزئیات سفارش"
        >
          <div className="wallet-payment-result__row">
            <span className="wallet-payment-result__row-label">مبلغ پرداختی</span>
            {isLoading ? (
              <span className="wallet-payment-result__skeleton" />
            ) : (
              <span className="wallet-payment-result__row-value wallet-payment-result__row-value--amount">
                <span className="wallet-payment-result__row-unit">تومان</span>
                <span>{order ? formatToman(order.amountToman) : '—'}</span>
              </span>
            )}
          </div>
          {accountOrder ? (
            <div className="wallet-payment-result__row">
              <span className="wallet-payment-result__row-label">محصول</span>
              {isLoading ? (
                <span className="wallet-payment-result__skeleton" />
              ) : (
                <span className="wallet-payment-result__row-value">{accountOrder.planName}</span>
              )}
            </div>
          ) : null}
          {accountOrder ? (
            <div className="wallet-payment-result__row">
              <span className="wallet-payment-result__row-label">دسته</span>
              {isLoading ? (
                <span className="wallet-payment-result__skeleton" />
              ) : (
                <span className="wallet-payment-result__row-value">
                  {accountCategoryLabel(accountOrder.accountCategoryId)}
                </span>
              )}
            </div>
          ) : null}
          <div className="wallet-payment-result__row">
            <span className="wallet-payment-result__row-label">شماره سفارش</span>
            {isLoading ? (
              <span className="wallet-payment-result__skeleton" />
            ) : (
              <span className="wallet-payment-result__row-value">
                {order?.orderId ?? orderId ?? '—'}
              </span>
            )}
          </div>
          {filledFields.map((field) => (
            <div key={field.id} className="wallet-payment-result__row">
              <span className="wallet-payment-result__row-label">{field.label}</span>
              <span className="wallet-payment-result__row-value" dir="auto">
                {accountOrder?.fieldValues[field.id]}
              </span>
            </div>
          ))}
        </section>
      </div>

      <footer
        className="wallet-payment-result__footer shop-rise"
        style={{ '--rise-index': 3 } as CSSProperties}
      >
        <button
          type="button"
          className="wallet-payment-result__primary"
          onClick={() => {
            haptic('light')
            handleBack()
          }}
        >
          رفتن به فروشگاه
        </button>
        <button
          type="button"
          className="wallet-payment-result__secondary"
          onClick={() => {
            haptic('light')
            navigate('/dashboard', { replace: true })
          }}
        >
          داشبورد
        </button>
      </footer>
    </div>
  )
}
