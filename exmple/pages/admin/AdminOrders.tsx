import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { EmptyState } from '../../components/EmptyState'
import { shopCategories } from '../../data/shopCategories'
import { useAdminAccess } from '../../hooks/useAdminAccess'
import { useTelegram } from '../../hooks/useTelegram'
import { fetchAdminOrders, type AdminOrderListItem } from '../../lib/adminApi'
import { balanceToToman } from '../../lib/api'
import {
  displayUsername,
  formatFaDateLong,
  formatFaNumber,
  orderStatusBadgeClass,
  orderStatusLabel,
  orderTitle,
  paymentMethodLabel,
} from './adminLabels'
import { AdminScreen } from './AdminScreen'

const STATUS_FILTERS = [
  { value: 'all', label: 'همه' },
  { value: 'pending', label: 'در انتظار' },
  { value: 'processing', label: 'در حال انجام' },
  { value: 'completed', label: 'موفق' },
  { value: 'failed', label: 'ناموفق' },
  { value: 'cancelled', label: 'لغو' },
]

export function AdminOrdersPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { haptic } = useTelegram()
  const { ready, allowed } = useAdminAccess()
  const initialStatus = searchParams.get('status') ?? 'all'
  const initialCategory = searchParams.get('category') ?? 'all'
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState(initialStatus)
  const [categorySlug, setCategorySlug] = useState(initialCategory)
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<AdminOrderListItem[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  }>({ show: false, message: '', type: 'error' })

  useEffect(() => {
    setStatus(searchParams.get('status') ?? 'all')
    setCategorySlug(searchParams.get('category') ?? 'all')
  }, [searchParams])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, status, categorySlug])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetchAdminOrders({
        page,
        limit: 20,
        search: debouncedSearch || undefined,
        status: status === 'all' ? undefined : status,
        categorySlug: categorySlug === 'all' ? undefined : categorySlug,
      })
      setItems(result.items)
      setTotalPages(result.totalPages)
    } catch (error) {
      setNotification({
        show: true,
        message: error instanceof Error ? error.message : 'خطا در دریافت سفارش‌ها',
        type: 'error',
      })
    } finally {
      setLoading(false)
    }
  }, [categorySlug, debouncedSearch, page, status])

  useEffect(() => {
    if (!ready || !allowed) return
    void load()
  }, [allowed, load, ready])

  const handleBack = useCallback(() => navigate('/admin', { replace: true }), [navigate])

  if (!ready || !allowed) return null

  return (
    <AdminScreen
      sticky
      title={status === 'failed' ? 'سفارش‌های ناموفق' : 'سفارش‌ها'}
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
            placeholder="جستجو شماره سفارش، یوزرنیم، آیدی…"
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
          <div className="admin__filters">
            <button
              type="button"
              className={`admin__chip${categorySlug === 'all' ? ' admin__chip--active' : ''}`}
              onClick={() => {
                haptic('light')
                setCategorySlug('all')
              }}
            >
              همه محصولات
            </button>
            {shopCategories
              .filter((category) => category.isActive)
              .map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={`admin__chip${categorySlug === category.id ? ' admin__chip--active' : ''}`}
                  onClick={() => {
                    haptic('light')
                    setCategorySlug(category.id)
                  }}
                >
                  {category.label}
                </button>
              ))}
          </div>
        </div>
      }
    >
      {loading ? (
        <p className="admin__muted">در حال بارگذاری…</p>
      ) : items.length === 0 ? (
        <EmptyState title="سفارشی پیدا نشد" />
      ) : (
        <ul className="admin__list">
          {items.map((order) => (
            <li key={order.orderId}>
              <button
                type="button"
                className="admin__row"
                onClick={() => {
                  haptic('light')
                  navigate(
                    order.category.slug === 'chatgpt'
                      ? `/admin/account-orders/${encodeURIComponent(order.orderId)}`
                      : `/admin/orders/${encodeURIComponent(order.orderId)}`,
                  )
                }}
              >
                <div className="admin__row-top">
                  <span className="admin__row-title">
                    {orderTitle(order.category.label, balanceToToman(order.amountToman))}
                  </span>
                  <span className={orderStatusBadgeClass(order.status)}>
                    {orderStatusLabel(order.status)}
                  </span>
                </div>
                <div className="admin__row-meta">
                  {displayUsername(order.user)} · {paymentMethodLabel(order.paymentMethod)} ·{' '}
                  {formatFaDateLong(order.createdAt)}
                </div>
              </button>
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
