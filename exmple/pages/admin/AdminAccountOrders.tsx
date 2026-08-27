import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '../../components/EmptyState'
import { ACCOUNT_SHOP_CATEGORY_OPTIONS } from '../../data/accountShopCategories'
import { useAdminAccess } from '../../hooks/useAdminAccess'
import { useTelegram } from '../../hooks/useTelegram'
import {
  fetchAdminAccountOrders,
  type AdminAccountOrderFulfillmentStatus,
  type AdminAccountOrderListItem,
} from '../../lib/adminApi'
import { balanceToToman } from '../../lib/api'
import {
  accountShopFulfillmentBadgeClass,
  accountShopFulfillmentLabel,
  displayUsername,
  formatFaDateLong,
  formatFaNumber,
  orderTitle,
  paymentMethodLabel,
} from './adminLabels'
import { AdminScreen } from './AdminScreen'

const TABS: Array<{ value: AdminAccountOrderFulfillmentStatus; label: string }> = [
  { value: 'registered', label: 'تأیید شده' },
  { value: 'processing', label: 'در حال پردازش' },
  { value: 'delivered', label: 'تحویل شده' },
]

function categoryLabel(categoryId: string): string {
  return ACCOUNT_SHOP_CATEGORY_OPTIONS.find((item) => item.id === categoryId)?.label ?? categoryId
}

export function AdminAccountOrdersPage() {
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const { ready, allowed } = useAdminAccess()
  const [status, setStatus] = useState<AdminAccountOrderFulfillmentStatus>('registered')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<AdminAccountOrderListItem[]>([])
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
      const result = await fetchAdminAccountOrders({
        page,
        limit: 20,
        status,
        search: debouncedSearch || undefined,
      })
      setItems(result.items)
      setTotalPages(result.totalPages)
    } catch (error) {
      setNotification({
        show: true,
        message: error instanceof Error ? error.message : 'خطا در دریافت سفارش‌های اکانت',
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
      title="سفارش‌های اکانت"
      eyebrow="فروشگاه"
      onBack={handleBack}
      notification={notification}
      onCloseNotification={() => setNotification((prev) => ({ ...prev, show: false }))}
      top={
        <div className="admin__toolbar">
          <input
            className="admin__search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="جستجو شماره سفارش، پلن، یوزرنیم…"
          />
          <div className="admin__filters">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                className={`admin__chip${status === tab.value ? ' admin__chip--active' : ''}`}
                onClick={() => {
                  haptic('light')
                  setStatus(tab.value)
                }}
              >
                {tab.label}
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
                  navigate(`/admin/account-orders/${encodeURIComponent(order.orderId)}`)
                }}
              >
                <div className="admin__row-top">
                  <span className="admin__row-title">
                    {orderTitle(order.planName, balanceToToman(order.amountToman))}
                  </span>
                  <span className={accountShopFulfillmentBadgeClass(order.fulfillmentStatus)}>
                    {accountShopFulfillmentLabel(order.fulfillmentStatus)}
                  </span>
                </div>
                <div className="admin__row-meta">
                  {categoryLabel(order.accountCategoryId)} · {displayUsername(order.user)} ·{' '}
                  {paymentMethodLabel(order.paymentMethod)} · {formatFaDateLong(order.createdAt)}
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
