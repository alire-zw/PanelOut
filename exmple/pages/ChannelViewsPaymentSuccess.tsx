import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import SuccessIcon from '../components/icons/SuccessIcon'
import { useTelegram } from '../hooks/useTelegram'
import { isTelegramWebApp } from '../lib/api'
import { fetchOrder } from '../lib/orders'
import type { ShopOrder } from '../lib/orders'
import '../styles/shop-rise.css'
import './WalletPaymentResult.css'
import './ChannelViewsPaymentResult.css'

function formatToman(value: string | number): string {
  const amount = typeof value === 'string' ? Number.parseInt(value, 10) : value
  if (!Number.isFinite(amount)) return '۰'
  return amount.toLocaleString('fa-IR')
}

export function ChannelViewsPaymentSuccessPage() {
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

  const channelView = order?.channelViewOrder
  const viewsCount = order?.quantity ?? channelView?.quantity ?? 0

  return (
    <div className="wallet-payment-result wallet-payment-result--success wallet-payment-result--channel-views">
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
          <h2 className="wallet-payment-result__title">خرید سین کانال با موفقیت انجام شد</h2>
          <p className="wallet-payment-result__subtitle">
            {viewsCount
              ? `${viewsCount.toLocaleString('fa-IR')} بازدید برای پست انتخابی ثبت شد.`
              : 'سفارش شما با موفقیت ثبت و پردازش شد.'}
          </p>
        </section>

        {channelView ? (
          <section
            className="channel-views-success-section shop-rise"
            style={{ '--rise-index': 2 } as CSSProperties}
            aria-label="پست انتخاب‌شده"
          >
            <span className="channel-views-success-section__label">پست</span>
            <div className="channel-views-success-post">
              <span className="channel-views-success-post__avatar">
                {channelView.postPhoto ? (
                  <img src={channelView.postPhoto} alt="" />
                ) : (
                  channelView.postTitle.charAt(0)
                )}
              </span>
              <div className="channel-views-success-post__meta">
                <span className="channel-views-success-post__title">{channelView.postTitle}</span>
                {channelView.postPreview ? (
                  <>
                    <span className="channel-views-success-post__sep" aria-hidden>
                      |
                    </span>
                    <span className="channel-views-success-post__preview">
                      {channelView.postPreview}
                    </span>
                  </>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        <section
          className="wallet-payment-result__card shop-rise"
          style={{ '--rise-index': 3 } as CSSProperties}
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
          {viewsCount ? (
            <div className="wallet-payment-result__row">
              <span className="wallet-payment-result__row-label">تعداد بازدید</span>
              {isLoading ? (
                <span className="wallet-payment-result__skeleton" />
              ) : (
                <span className="wallet-payment-result__row-value">
                  {viewsCount.toLocaleString('fa-IR')}
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
        </section>
      </div>

      <footer
        className="wallet-payment-result__footer channel-views-success-footer shop-rise"
        style={{ '--rise-index': 4 } as CSSProperties}
      >
        <button
          type="button"
          className="channel-views-success-footer__primary"
          onClick={() => {
            haptic('light')
            handleBack()
          }}
        >
          رفتن به فروشگاه
        </button>
        <button
          type="button"
          className="channel-views-success-footer__secondary"
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
