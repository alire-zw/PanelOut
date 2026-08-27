import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '../../components/EmptyState'
import { useAdminAccess } from '../../hooks/useAdminAccess'
import { useTelegram } from '../../hooks/useTelegram'
import { fetchAdminCryptoPayments, type AdminCryptoPaymentItem } from '../../lib/adminApi'
import { balanceToToman } from '../../lib/api'
import {
  cryptoPaymentTitle,
  cryptoStatusLabel,
  displayUsername,
  formatFaDateLong,
  formatFaNumber,
  orderStatusBadgeClass,
  paymentTitle,
} from './adminLabels'
import { AdminScreen } from './AdminScreen'

const STATUS_FILTERS = [
  { value: 'all', label: 'همه' },
  { value: 'pending', label: 'در انتظار' },
  { value: 'completed', label: 'موفق' },
  { value: 'expired', label: 'منقضی' },
  { value: 'swept', label: 'جمع‌آوری' },
]

export function AdminCryptoPage() {
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const { ready, allowed } = useAdminAccess()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<AdminCryptoPaymentItem[]>([])
  const [totalPages, setTotalPages] = useState(1)
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
      const result = await fetchAdminCryptoPayments({
        page,
        limit: 20,
        search: debouncedSearch || undefined,
        status: status === 'all' ? undefined : status,
      })
      setItems(result.items)
      setTotalPages(result.totalPages)
    } catch (error) {
      setNotification({
        show: true,
        message: error instanceof Error ? error.message : 'خطا در دریافت پرداخت‌های ترون',
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

  const handleBack = useCallback(() => navigate('/admin', { replace: true }), [navigate])

  if (!ready || !allowed) return null

  return (
    <AdminScreen
      sticky
      title="پرداخت ترون"
      eyebrow="مالی"
      onBack={handleBack}
      notification={notification}
      onCloseNotification={() => setNotification((prev) => ({ ...prev, show: false }))}
      top={
        <div className="admin__toolbar">
          <input
            className="admin__search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="جستجو شماره سفارش یا هش…"
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
            <li key={payment.orderId}>
              <div className="admin__row" style={{ cursor: 'default' }}>
                <div className="admin__row-top">
                  <span className="admin__row-title">
                    {cryptoPaymentTitle(payment.orderId, payment.amountTrx)}
                  </span>
                  <span
                    className={orderStatusBadgeClass(
                      payment.status === 'completed' || payment.status === 'swept'
                        ? 'completed'
                        : payment.status === 'expired'
                          ? 'failed'
                          : 'pending',
                    )}
                  >
                    {cryptoStatusLabel(payment.status)}
                  </span>
                </div>
                <div className="admin__row-meta">
                  {paymentTitle(payment.orderId)} ·{' '}
                  {formatFaNumber(balanceToToman(payment.amountToman))} تومان
                </div>
                <div className="admin__row-meta">
                  {displayUsername(payment.user)} · {formatFaDateLong(payment.createdAt)}
                </div>
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
