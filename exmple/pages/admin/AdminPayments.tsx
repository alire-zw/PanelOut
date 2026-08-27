import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '../../components/EmptyState'
import CopyIcon from '../../components/icons/CopyIcon'
import { useAdminAccess } from '../../hooks/useAdminAccess'
import { useTelegram } from '../../hooks/useTelegram'
import { fetchAdminPayments, type AdminPaymentListItem } from '../../lib/adminApi'
import { balanceToToman } from '../../lib/api'
import {
  displayUsername,
  formatFaDateLong,
  formatFaNumber,
  orderStatusBadgeClass,
  paymentStatusLabel,
  paymentTitle,
} from './adminLabels'
import { AdminScreen } from './AdminScreen'

const STATUS_FILTERS = [
  { value: 'all', label: 'همه' },
  { value: 'pending', label: 'در انتظار' },
  { value: 'paid', label: 'پرداخت‌شده' },
  { value: 'verified', label: 'تأیید شده' },
  { value: 'failed', label: 'ناموفق' },
]

export function AdminPaymentsPage() {
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const { ready, allowed } = useAdminAccess()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<AdminPaymentListItem[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  }>({ show: false, message: '', type: 'error' })

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, status])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetchAdminPayments({
        page,
        limit: 20,
        search: debouncedSearch || undefined,
        status: status === 'all' ? undefined : status,
      })
      setItems(result.items)
      setTotalPages(result.totalPages)
      setTotal(result.total)
    } catch (error) {
      setNotification({
        show: true,
        message: error instanceof Error ? error.message : 'خطا در دریافت پرداخت‌ها',
        type: 'error',
      })
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, page, status])

  useEffect(() => {
    if (!ready || !allowed) return
    void load()
  }, [allowed, load, ready])

  const handleBack = useCallback(() => {
    navigate('/admin', { replace: true })
  }, [navigate])

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

  return (
    <AdminScreen
      sticky
      title="پرداخت‌ها"
      eyebrow="مالی"
      meta={
        <div className="admin-hub__live">
          <span>{loading ? '…' : formatFaNumber(total)} مورد</span>
        </div>
      }
      onBack={handleBack}
      notification={notification}
      onCloseNotification={() => setNotification((prev) => ({ ...prev, show: false }))}
      top={
        <div className="admin__toolbar">
          <input
            className="admin__search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="جستجو شماره سفارش یا کد پیگیری…"
          />
          <div className="admin__filters">
            {STATUS_FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                className={`admin__chip${status === item.value ? ' admin__chip--active' : ''}`}
                onClick={() => {
                  haptic('light')
                  setStatus(item.value)
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      }
    >
      {loading ? (
        <p className="admin__muted">در حال بارگذاری…</p>
      ) : items.length === 0 ? (
        <EmptyState title="پرداختی پیدا نشد" />
      ) : (
        <ul className="admin__list">
          {items.map((payment) => (
            <li key={payment.id}>
              <div className="admin-pay-row">
                <div className="admin-pay-row__main">
                  <div className="admin-pay-row__top">
                    <span className="admin-pay-row__title">{paymentTitle(payment.orderId)}</span>
                    <span
                      className={orderStatusBadgeClass(
                        payment.status === 'failed'
                          ? 'failed'
                          : payment.status === 'verified' || payment.status === 'paid'
                            ? 'completed'
                            : 'pending',
                      )}
                    >
                      {paymentStatusLabel(payment.status)}
                    </span>
                  </div>
                  <div className="admin-pay-row__meta">
                    <span className="admin-pay-row__amount">
                      {formatFaNumber(balanceToToman(payment.amountToman))} تومان
                    </span>
                    <span>
                      {payment.user ? displayUsername(payment.user) : 'بدون کاربر'}
                    </span>
                    <span>{formatFaDateLong(payment.createdAt)}</span>
                  </div>
                </div>
                {payment.trackId && (
                  <button
                    type="button"
                    className="admin-icon-btn"
                    aria-label="کپی کد پیگیری"
                    onClick={() => void copyText(payment.trackId ?? '')}
                  >
                    <CopyIcon width={15} height={15} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="admin__pager">
        <button
          type="button"
          className="admin__pager-btn"
          disabled={page <= 1 || loading}
          onClick={() => setPage((prev) => Math.max(1, prev - 1))}
        >
          قبلی
        </button>
        <span className="admin__muted" style={{ margin: 0 }}>
          {formatFaNumber(page)} / {formatFaNumber(totalPages)}
        </span>
        <button
          type="button"
          className="admin__pager-btn"
          disabled={page >= totalPages || loading}
          onClick={() => setPage((prev) => prev + 1)}
        >
          بعدی
        </button>
      </div>
    </AdminScreen>
  )
}
