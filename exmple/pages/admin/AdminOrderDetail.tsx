import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAdminAccess } from '../../hooks/useAdminAccess'
import { useTelegram } from '../../hooks/useTelegram'
import { fetchAdminOrder, type AdminOrderDetailResponse } from '../../lib/adminApi'
import { balanceToToman } from '../../lib/api'
import {
  displayUsername,
  formatFaDateTimeLong,
  formatFaNumber,
  orderStatusBadgeClass,
  orderStatusLabel,
  orderTitle,
  paymentMethodLabel,
  paymentStatusLabel,
  cryptoStatusLabel,
  roleLabel,
} from './adminLabels'
import { AdminScreen } from './AdminScreen'
import CopyIcon from '../../components/icons/CopyIcon'

function ArrowMini() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m15 18-6-6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function AdminOrderDetailPage() {
  const navigate = useNavigate()
  const { orderId: rawOrderId } = useParams()
  const orderId = rawOrderId ? decodeURIComponent(rawOrderId) : ''
  const { haptic } = useTelegram()
  const { ready, allowed } = useAdminAccess()
  const [detail, setDetail] = useState<AdminOrderDetailResponse | null>(null)
  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  }>({ show: false, message: '', type: 'error' })

  const handleBack = useCallback(() => {
    navigate('/admin/orders', { replace: true })
  }, [navigate])

  useEffect(() => {
    if (!ready || !allowed || !orderId) return

    let cancelled = false
    void fetchAdminOrder(orderId)
      .then((result) => {
        if (!cancelled) setDetail(result)
      })
      .catch((error) => {
        if (!cancelled) {
          setNotification({
            show: true,
            message: error instanceof Error ? error.message : 'خطا در دریافت سفارش',
            type: 'error',
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [allowed, orderId, ready])

  const copyText = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      haptic('light')
      setNotification({ show: true, message: 'کپی شد', type: 'success' })
    } catch {
      setNotification({ show: true, message: 'کپی ناموفق بود', type: 'error' })
    }
  }

  if (!ready || !allowed) return null

  const order = detail?.order
  const buyerInitial = detail
    ? displayUsername(detail.user).replace('@', '').trim().slice(0, 1) || 'ک'
    : 'ک'

  return (
    <AdminScreen
      title="جزئیات سفارش"
      eyebrow="مالی"
      onBack={handleBack}
      notification={notification}
      onCloseNotification={() => setNotification((prev) => ({ ...prev, show: false }))}
    >
      {!order || !detail ? (
        <p className="admin__muted">در حال بارگذاری…</p>
      ) : (
        <>
          <section className="admin-profile">
            <div className="admin-profile__head">
              <div className="admin-profile__identity">
                <h2 className="admin-profile__name">
                  {orderTitle(order.category.label, balanceToToman(order.amountToman))}
                </h2>
                <p className="admin-profile__handle">{formatFaDateTimeLong(order.createdAt)}</p>
              </div>
              <div className="admin-profile__head-actions">
                <button
                  type="button"
                  className="admin-icon-btn"
                  aria-label="کپی شماره سفارش"
                  onClick={() => void copyText(order.orderId)}
                >
                  <CopyIcon width={16} height={16} />
                </button>
                <span className={orderStatusBadgeClass(order.status)}>
                  {orderStatusLabel(order.status)}
                </span>
              </div>
            </div>
            <div className="admin-profile__stats">
              <div className="admin-profile__stat">
                <span className="admin-profile__stat-label">مبلغ</span>
                <span className="admin-profile__stat-value">
                  {formatFaNumber(balanceToToman(order.amountToman))}
                </span>
              </div>
              <div className="admin-profile__stat">
                <span className="admin-profile__stat-label">پرداخت</span>
                <span
                  className="admin-profile__stat-value"
                  style={{ direction: 'rtl', textAlign: 'right' }}
                >
                  {paymentMethodLabel(order.paymentMethod)}
                </span>
              </div>
              <div className="admin-profile__stat">
                <span className="admin-profile__stat-label">گیرنده</span>
                <span className="admin-profile__stat-value">
                  {order.recipientUsername
                    ? `@${order.recipientUsername}`
                    : order.recipientName ?? '—'}
                </span>
              </div>
            </div>
          </section>

          <div className="admin-ops">
            <h3 className="admin-ops__title">خریدار</h3>
            <button
              type="button"
              className="admin-buyer"
              onClick={() => {
                haptic('light')
                navigate(`/admin/users/${detail.user.id}`)
              }}
            >
              <span className="admin-buyer__avatar">{buyerInitial}</span>
              <span className="admin-buyer__body">
                <span className="admin-buyer__name">{displayUsername(detail.user)}</span>
                <span className="admin-buyer__meta">
                  {roleLabel(detail.user.role)}
                  {detail.user.username ? ` · @${detail.user.username}` : ''}
                </span>
              </span>
              <span className="admin-buyer__arrow">
                <ArrowMini />
              </span>
            </button>

            {(detail.payment || detail.cryptoPayment) && (
              <h3 className="admin-ops__title">درگاه پرداخت</h3>
            )}

            {detail.payment && (
              <div className="admin-pay">
                <div className="admin-pay__top">
                  <div>
                    <p className="admin-pay__brand">زیبال</p>
                    <p className="admin-pay__sub">درگاه بانکی</p>
                  </div>
                  <span
                    className={orderStatusBadgeClass(
                      detail.payment.status === 'failed'
                        ? 'failed'
                        : detail.payment.status === 'verified' || detail.payment.status === 'paid'
                          ? 'completed'
                          : 'pending',
                    )}
                  >
                    {paymentStatusLabel(detail.payment.status)}
                  </span>
                </div>
                <div className="admin-pay__grid">
                  <button
                    type="button"
                    className="admin-pay__cell"
                    disabled={!detail.payment.trackId}
                    onClick={() => {
                      if (detail.payment?.trackId) void copyText(detail.payment.trackId)
                    }}
                  >
                    <span className="admin-pay__cell-label">کد پیگیری</span>
                    <span className="admin-pay__cell-value" dir="ltr">
                      {detail.payment.trackId
                        ? formatFaNumber(detail.payment.trackId)
                        : '—'}
                    </span>
                  </button>
                  <div className="admin-pay__cell">
                    <span className="admin-pay__cell-label">شماره مرجع</span>
                    <span className="admin-pay__cell-value" dir="ltr">
                      {detail.payment.refNumber ?? '—'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {detail.cryptoPayment && (
              <div className="admin-pay admin-pay--crypto">
                <div className="admin-pay__top">
                  <div>
                    <p className="admin-pay__brand">ترون</p>
                    <p className="admin-pay__sub">پرداخت کریپتو</p>
                  </div>
                  <span
                    className={orderStatusBadgeClass(
                      detail.cryptoPayment.status === 'completed' ||
                        detail.cryptoPayment.status === 'swept'
                        ? 'completed'
                        : detail.cryptoPayment.status === 'expired'
                          ? 'failed'
                          : 'pending',
                    )}
                  >
                    {cryptoStatusLabel(detail.cryptoPayment.status)}
                  </span>
                </div>
                <div className="admin-pay__grid">
                  <div className="admin-pay__cell">
                    <span className="admin-pay__cell-label">مبلغ</span>
                    <span className="admin-pay__cell-value">
                      {formatFaNumber(detail.cryptoPayment.amountTrx)} TRX
                    </span>
                  </div>
                  <button
                    type="button"
                    className="admin-pay__cell"
                    disabled={!detail.cryptoPayment.incomingTxHash}
                    onClick={() => {
                      if (detail.cryptoPayment?.incomingTxHash) {
                        void copyText(detail.cryptoPayment.incomingTxHash)
                      }
                    }}
                  >
                    <span className="admin-pay__cell-label">هش</span>
                    <span className="admin-pay__cell-value admin-pay__cell-value--clip" dir="ltr">
                      {detail.cryptoPayment.incomingTxHash
                        ? `${detail.cryptoPayment.incomingTxHash.slice(0, 8)}…`
                        : '—'}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </AdminScreen>
  )
}
