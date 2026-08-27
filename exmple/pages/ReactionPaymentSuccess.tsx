import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { EmojiGlyph } from '../components/EmojiGlyph'
import { PageHeader } from '../components/PageHeader'
import SuccessIcon from '../components/icons/SuccessIcon'
import { useTelegram } from '../hooks/useTelegram'
import { isTelegramWebApp } from '../lib/api'
import { fetchOrder } from '../lib/orders'
import type { ShopOrder } from '../lib/orders'
import '../styles/shop-rise.css'
import './WalletPaymentResult.css'
import './ReactionPaymentResult.css'

function formatToman(value: string | number): string {
  const amount = typeof value === 'string' ? Number.parseInt(value, 10) : value
  if (!Number.isFinite(amount)) return '۰'
  return amount.toLocaleString('fa-IR')
}

export function ReactionPaymentSuccessPage() {
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

  const reaction = order?.reactionOrder
  const items = reaction?.items ?? []
  const totalReactions =
    order?.quantity ?? items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <div className="wallet-payment-result wallet-payment-result--success wallet-payment-result--reaction">
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
          <h2 className="wallet-payment-result__title">خرید ری‌اکشن با موفقیت انجام شد</h2>
          <p className="wallet-payment-result__subtitle">
            {totalReactions
              ? `${totalReactions.toLocaleString('fa-IR')} ری‌اکشن برای پست انتخابی ثبت شد.`
              : 'سفارش شما با موفقیت ثبت و پردازش شد.'}
          </p>
        </section>

        {reaction ? (
          <section
            className="reaction-success-section shop-rise"
            style={{ '--rise-index': 2 } as CSSProperties}
            aria-label="پست انتخاب‌شده"
          >
            <span className="reaction-success-section__label">پست</span>
            <div className="reaction-success-post">
              <span className="reaction-success-post__avatar">
                {reaction.postPhoto ? (
                  <img src={reaction.postPhoto} alt="" />
                ) : (
                  reaction.postTitle.charAt(0)
                )}
              </span>
              <div className="reaction-success-post__meta">
                <span className="reaction-success-post__title">{reaction.postTitle}</span>
                {reaction.postPreview ? (
                  <>
                    <span className="reaction-success-post__sep" aria-hidden>
                      |
                    </span>
                    <span className="reaction-success-post__preview">{reaction.postPreview}</span>
                  </>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {items.length > 0 ? (
          <section
            className="reaction-success-section shop-rise"
            style={{ '--rise-index': 3 } as CSSProperties}
            aria-label="ری‌اکشن‌های ثبت‌شده"
          >
            <span className="reaction-success-section__label">ری‌اکشن‌ها</span>
            <div className="reaction-success-emojis">
              {items.map((item) => (
                <div
                  key={item.serviceId}
                  className="reaction-success-emojis__item"
                  aria-label={`${item.emoji}، ${item.quantity}`}
                >
                  <span className="reaction-success-emojis__glyph" aria-hidden>
                    <EmojiGlyph emoji={item.emoji} size={18} />
                  </span>
                  <span className="reaction-success-emojis__count">
                    {item.quantity.toLocaleString('fa-IR')}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section
          className="wallet-payment-result__card shop-rise"
          style={{ '--rise-index': 4 } as CSSProperties}
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
          {totalReactions ? (
            <div className="wallet-payment-result__row">
              <span className="wallet-payment-result__row-label">تعداد ری‌اکشن</span>
              {isLoading ? (
                <span className="wallet-payment-result__skeleton" />
              ) : (
                <span className="wallet-payment-result__row-value">
                  {totalReactions.toLocaleString('fa-IR')}
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
        className="wallet-payment-result__footer reaction-success-footer shop-rise"
        style={{ '--rise-index': 5 } as CSSProperties}
      >
        <button
          type="button"
          className="reaction-success-footer__primary"
          onClick={() => {
            haptic('light')
            handleBack()
          }}
        >
          رفتن به فروشگاه
        </button>
        <button
          type="button"
          className="reaction-success-footer__secondary"
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
