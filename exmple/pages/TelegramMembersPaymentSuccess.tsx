import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import SuccessIcon from '../components/icons/SuccessIcon'
import { findTelegramMemberService } from '../types/telegramMembers'
import { useTelegram } from '../hooks/useTelegram'
import { isTelegramWebApp } from '../lib/api'
import { fetchOrder, type ShopOrder } from '../lib/orders'
import '../styles/shop-rise.css'
import './WalletPaymentResult.css'
import './TelegramMembersPaymentResult.css'

function formatToman(value: string | number): string {
  const amount = typeof value === 'string' ? Number.parseInt(value, 10) : value
  if (!Number.isFinite(amount)) return '۰'
  return amount.toLocaleString('fa-IR')
}

export function TelegramMembersPaymentSuccessPage() {
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

  const memberOrder = order?.telegramMemberOrder
  const membersCount = order?.quantity ?? memberOrder?.quantity ?? 0
  const serviceName =
    memberOrder != null
      ? findTelegramMemberService(memberOrder.serviceId)?.name ?? `سرویس ${memberOrder.serviceId}`
      : null

  return (
    <div className="wallet-payment-result wallet-payment-result--success wallet-payment-result--telegram-members">
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
          <h2 className="wallet-payment-result__title">خرید ممبر تلگرام با موفقیت انجام شد</h2>
          <p className="wallet-payment-result__subtitle">
            {membersCount
              ? `${membersCount.toLocaleString('fa-IR')} ممبر برای کانال انتخابی ثبت شد.`
              : 'سفارش شما با موفقیت ثبت و پردازش شد.'}
          </p>
        </section>

        {memberOrder ? (
          <section
            className="telegram-members-success-section shop-rise"
            style={{ '--rise-index': 2 } as CSSProperties}
            aria-label="کانال انتخاب‌شده"
          >
            <span className="telegram-members-success-section__label">کانال</span>
            <div className="telegram-members-success-channel">
              <div className="telegram-members-success-channel__info">
                <span className="telegram-members-success-channel__title">
                  {memberOrder.channelTitle}
                </span>
                <span className="telegram-members-success-channel__sep" aria-hidden>
                  |
                </span>
                <span className="telegram-members-success-channel__preview" dir="ltr">
                  @{memberOrder.channelUsername}
                </span>
              </div>
              <span className="telegram-members-success-channel__avatar">
                {memberOrder.channelPhoto ? (
                  <img src={memberOrder.channelPhoto} alt="" />
                ) : (
                  memberOrder.channelTitle.charAt(0)
                )}
              </span>
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
          {serviceName ? (
            <div className="wallet-payment-result__row">
              <span className="wallet-payment-result__row-label">نوع ممبر</span>
              {isLoading ? (
                <span className="wallet-payment-result__skeleton" />
              ) : (
                <span className="wallet-payment-result__row-value">{serviceName}</span>
              )}
            </div>
          ) : null}
          {membersCount ? (
            <div className="wallet-payment-result__row">
              <span className="wallet-payment-result__row-label">تعداد ممبر</span>
              {isLoading ? (
                <span className="wallet-payment-result__skeleton" />
              ) : (
                <span className="wallet-payment-result__row-value">
                  {membersCount.toLocaleString('fa-IR')}
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
        className="wallet-payment-result__footer telegram-members-success-footer shop-rise"
        style={{ '--rise-index': 4 } as CSSProperties}
      >
        <button
          type="button"
          className="telegram-members-success-footer__primary"
          onClick={() => {
            haptic('light')
            handleBack()
          }}
        >
          رفتن به فروشگاه
        </button>
        <button
          type="button"
          className="telegram-members-success-footer__secondary"
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
