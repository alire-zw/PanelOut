import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import CopyIcon from '../../components/icons/CopyIcon'
import { ACCOUNT_SHOP_CATEGORY_OPTIONS } from '../../data/accountShopCategories'
import { useAdminAccess } from '../../hooks/useAdminAccess'
import { useTelegram } from '../../hooks/useTelegram'
import {
  fetchAdminAccountOrder,
  updateAdminAccountOrderStatus,
  type AdminAccountOrderFulfillmentStatus,
  type AdminAccountOrderListItem,
} from '../../lib/adminApi'
import { balanceToToman } from '../../lib/api'
import {
  accountShopFulfillmentBadgeClass,
  accountShopFulfillmentLabel,
  displayUsername,
  formatFaDateTimeLong,
  formatFaNumber,
  orderStatusBadgeClass,
  orderTitle,
  paymentMethodLabel,
  paymentStatusLabel,
  roleLabel,
} from './adminLabels'
import { AdminScreen } from './AdminScreen'

const STATUS_OPTIONS: Array<{
  value: AdminAccountOrderFulfillmentStatus
  label: string
}> = [
  { value: 'registered', label: 'تأیید شده' },
  { value: 'processing', label: 'در حال پردازش' },
  { value: 'delivered', label: 'تحویل شده' },
]

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

function categoryLabel(categoryId: string): string {
  return ACCOUNT_SHOP_CATEGORY_OPTIONS.find((item) => item.id === categoryId)?.label ?? categoryId
}

export function AdminAccountOrderDetailPage() {
  const navigate = useNavigate()
  const { orderId: rawOrderId } = useParams()
  const orderId = rawOrderId ? decodeURIComponent(rawOrderId) : ''
  const { haptic } = useTelegram()
  const { ready, allowed } = useAdminAccess()
  const [order, setOrder] = useState<AdminAccountOrderListItem | null>(null)
  const [busy, setBusy] = useState(false)
  const [selectedStatus, setSelectedStatus] =
    useState<AdminAccountOrderFulfillmentStatus>('registered')
  const [deliveryNote, setDeliveryNote] = useState('')
  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  }>({ show: false, message: '', type: 'error' })

  const handleBack = useCallback(() => {
    navigate('/admin/account-orders', { replace: true })
  }, [navigate])

  useEffect(() => {
    if (!ready || !allowed || !orderId) return

    let cancelled = false
    void fetchAdminAccountOrder(orderId)
      .then((result) => {
        if (!cancelled) {
          setOrder(result.order)
          setSelectedStatus(result.order.fulfillmentStatus)
          setDeliveryNote(result.order.deliveryNote ?? '')
        }
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

  const dirty = useMemo(() => {
    if (!order) return false
    const note = deliveryNote.trim()
    const savedNote = (order.deliveryNote ?? '').trim()
    return selectedStatus !== order.fulfillmentStatus || note !== savedNote
  }, [deliveryNote, order, selectedStatus])

  const applyChanges = async () => {
    if (!order || busy || !dirty) return

    if (selectedStatus === 'delivered' && !deliveryNote.trim()) {
      setNotification({
        show: true,
        message: 'برای تحویل، اطلاعات تحویل را بنویسید',
        type: 'warning',
      })
      return
    }

    haptic('light')
    setBusy(true)
    try {
      const result = await updateAdminAccountOrderStatus(order.orderId, selectedStatus, {
        deliveryNote: deliveryNote.trim() || undefined,
      })
      setOrder(result.order)
      setSelectedStatus(result.order.fulfillmentStatus)
      setDeliveryNote(result.order.deliveryNote ?? '')
      setNotification({
        show: true,
        message:
          selectedStatus === 'delivered' && order.fulfillmentStatus !== 'delivered'
            ? 'سفارش تحویل شد'
            : 'وضعیت سفارش به‌روز شد',
        type: 'success',
      })
    } catch (error) {
      setNotification({
        show: true,
        message: error instanceof Error ? error.message : 'خطا در به‌روزرسانی وضعیت',
        type: 'error',
      })
    } finally {
      setBusy(false)
    }
  }

  if (!ready || !allowed) return null

  const buyerInitial = order
    ? displayUsername(order.user).replace('@', '').trim().slice(0, 1) || 'ک'
    : 'ک'

  return (
    <AdminScreen
      title="جزئیات سفارش اکانت"
      eyebrow="فروشگاه"
      onBack={handleBack}
      notification={notification}
      onCloseNotification={() => setNotification((prev) => ({ ...prev, show: false }))}
    >
      {!order ? (
        <p className="admin__muted">در حال بارگذاری…</p>
      ) : (
        <>
          <section className="admin-profile">
            <div className="admin-profile__head">
              <div className="admin-profile__identity">
                <h2 className="admin-profile__name">
                  {orderTitle(order.planName, balanceToToman(order.amountToman))}
                </h2>
                <p className="admin-profile__handle">
                  {categoryLabel(order.accountCategoryId)} · {formatFaDateTimeLong(order.createdAt)}
                </p>
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
                <span className={accountShopFulfillmentBadgeClass(order.fulfillmentStatus)}>
                  {accountShopFulfillmentLabel(order.fulfillmentStatus)}
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
                <span className="admin-profile__stat-label">دسته</span>
                <span className="admin-profile__stat-value">
                  {categoryLabel(order.accountCategoryId)}
                </span>
              </div>
            </div>
          </section>

          <div className="admin-ops">
            <h3 className="admin-ops__title">وضعیت سفارش</h3>
            <p className="admin__muted" style={{ marginTop: -4, marginBottom: 8 }}>
              وضعیت را آزادانه عوض کنید؛ بعد از ویرایش روی اعمال بزنید.
            </p>
            <div className="admin__filters">
              {STATUS_OPTIONS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`admin__chip${selectedStatus === item.value ? ' admin__chip--active' : ''}`}
                  disabled={busy}
                  onClick={() => {
                    haptic('light')
                    setSelectedStatus(item.value)
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <h3 className="admin-ops__title">اطلاعات تحویل</h3>
            <div className="admin-ops__panel">
              <label className="admin__field" style={{ display: 'grid', gap: 8 }}>
                <span className="admin__field-label">
                  متن تحویل برای کاربر
                  {selectedStatus === 'delivered' ? ' (الزامی)' : ''}
                </span>
                <textarea
                  className="admin__textarea"
                  rows={6}
                  value={deliveryNote}
                  maxLength={4000}
                  placeholder="مثلاً ایمیل، رمز عبور، لینک فعال‌سازی و هر توضیح لازم…"
                  onChange={(event) => setDeliveryNote(event.target.value)}
                  disabled={busy}
                  dir="auto"
                />
              </label>
              {order.deliveredAt ? (
                <p className="admin__muted" style={{ marginTop: 8, marginBottom: 0 }}>
                  آخرین تحویل: {formatFaDateTimeLong(order.deliveredAt)}
                </p>
              ) : null}
            </div>

            <button
              type="button"
              className="admin__btn"
              disabled={busy || !dirty}
              onClick={() => void applyChanges()}
            >
              {busy ? 'در حال ذخیره…' : dirty ? 'اعمال تغییرات' : 'تغییری نیست'}
            </button>

            <h3 className="admin-ops__title">خریدار</h3>
            <button
              type="button"
              className="admin-buyer"
              onClick={() => {
                haptic('light')
                navigate(`/admin/users/${order.user.id}`)
              }}
            >
              <span className="admin-buyer__avatar">{buyerInitial}</span>
              <span className="admin-buyer__body">
                <span className="admin-buyer__name">{displayUsername(order.user)}</span>
                <span className="admin-buyer__meta">
                  {roleLabel(order.user.role ?? 'user')}
                  {order.user.username ? ` · @${order.user.username}` : ''}
                  {order.user.phoneNumber ? ` · ${order.user.phoneNumber}` : ''}
                </span>
              </span>
              <span className="admin-buyer__arrow">
                <ArrowMini />
              </span>
            </button>

            <h3 className="admin-ops__title">محصول</h3>
            <div className="admin__card" style={{ margin: 0 }}>
              <div className="admin__field">
                <span className="admin__field-label">شماره سفارش</span>
                <span className="admin__field-value admin__field-value--ltr">{order.orderId}</span>
              </div>
              <div className="admin__field">
                <span className="admin__field-label">نام پلن</span>
                <span className="admin__field-value">{order.planName}</span>
              </div>
              <div className="admin__field">
                <span className="admin__field-label">مدت</span>
                <span className="admin__field-value">{order.durationLabel || '—'}</span>
              </div>
              <div className="admin__field">
                <span className="admin__field-label">گارانتی</span>
                <span className="admin__field-value">{order.warrantyLabel || '—'}</span>
              </div>
            </div>

            {order.filledFields.length > 0 ? (
              <>
                <h3 className="admin-ops__title">اطلاعات سفارش</h3>
                <div className="admin__card" style={{ margin: 0 }}>
                  {order.filledFields.map((field) => (
                    <button
                      key={field.id}
                      type="button"
                      className="admin__field"
                      style={{
                        display: 'flex',
                        width: '100%',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: 10,
                        padding: 0,
                        border: 0,
                        background: 'transparent',
                        color: 'inherit',
                        font: 'inherit',
                        textAlign: 'start',
                        cursor: 'pointer',
                      }}
                      onClick={() => void copyText(field.value)}
                    >
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span className="admin__field-label">{field.label}</span>
                        <span
                          className="admin__field-value"
                          dir="auto"
                          style={{ whiteSpace: 'pre-wrap', display: 'block' }}
                        >
                          {field.value}
                        </span>
                      </span>
                      <CopyIcon width={14} height={14} />
                    </button>
                  ))}
                </div>
              </>
            ) : null}

            {order.payment ? (
              <>
                <h3 className="admin-ops__title">درگاه پرداخت</h3>
                <div className="admin-pay">
                  <div className="admin-pay__top">
                    <div>
                      <p className="admin-pay__brand">زیبال</p>
                      <p className="admin-pay__sub">درگاه بانکی</p>
                    </div>
                    <span
                      className={orderStatusBadgeClass(
                        order.payment.status === 'failed'
                          ? 'failed'
                          : order.payment.status === 'verified' || order.payment.status === 'paid'
                            ? 'completed'
                            : 'pending',
                      )}
                    >
                      {paymentStatusLabel(order.payment.status)}
                    </span>
                  </div>
                  <div className="admin-pay__grid">
                    <button
                      type="button"
                      className="admin-pay__cell"
                      disabled={!order.payment.trackId}
                      onClick={() => {
                        if (order.payment?.trackId) void copyText(order.payment.trackId)
                      }}
                    >
                      <span className="admin-pay__cell-label">کد پیگیری</span>
                      <span className="admin-pay__cell-value" dir="ltr">
                        {order.payment.trackId ? formatFaNumber(order.payment.trackId) : '—'}
                      </span>
                    </button>
                    <div className="admin-pay__cell">
                      <span className="admin-pay__cell-label">شماره مرجع</span>
                      <span className="admin-pay__cell-value" dir="ltr">
                        {order.payment.refNumber ?? '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            ) : null}

            {Number(order.walletAmountToman) > 0 && Number(order.gatewayAmountToman) > 0 ? (
              <>
                <h3 className="admin-ops__title">تقسیم مبلغ</h3>
                <div className="admin__card" style={{ margin: 0 }}>
                  <div className="admin__field">
                    <span className="admin__field-label">از کیف پول</span>
                    <span className="admin__field-value">
                      {formatFaNumber(balanceToToman(order.walletAmountToman))} تومان
                    </span>
                  </div>
                  <div className="admin__field">
                    <span className="admin__field-label">از درگاه</span>
                    <span className="admin__field-value">
                      {formatFaNumber(balanceToToman(order.gatewayAmountToman))} تومان
                    </span>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </>
      )}
    </AdminScreen>
  )
}
