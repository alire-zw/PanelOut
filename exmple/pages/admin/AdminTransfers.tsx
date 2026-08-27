import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '../../components/EmptyState'
import { useAdminAccess } from '../../hooks/useAdminAccess'
import { fetchAdminTransfers, type AdminTransferItem } from '../../lib/adminApi'
import { balanceToToman } from '../../lib/api'
import {
  displayUsername,
  formatFaDateLong,
  formatFaNumber,
  transferTitle,
} from './adminLabels'
import { AdminScreen } from './AdminScreen'

export function AdminTransfersPage() {
  const navigate = useNavigate()
  const { ready, allowed } = useAdminAccess()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<AdminTransferItem[]>([])
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
  }, [debouncedSearch])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetchAdminTransfers({
        page,
        limit: 20,
        search: debouncedSearch || undefined,
      })
      setItems(result.items)
      setTotalPages(result.totalPages)
    } catch (error) {
      setNotification({
        show: true,
        message: error instanceof Error ? error.message : 'خطا در دریافت انتقال‌ها',
        type: 'error',
      })
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, page])

  useEffect(() => {
    if (!ready || !allowed) return
    void load()
  }, [allowed, load, ready])

  const handleBack = useCallback(() => navigate('/admin', { replace: true }), [navigate])

  if (!ready || !allowed) return null

  return (
    <AdminScreen
      sticky
      title="انتقال کیف پول"
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
            placeholder="جستجو یوزرنیم فرستنده یا گیرنده…"
          />
        </div>
      }
    >
      {loading ? (
        <p className="admin__muted">در حال بارگذاری…</p>
      ) : items.length === 0 ? (
        <EmptyState title="انتقالی پیدا نشد" />
      ) : (
        <ul className="admin__list">
          {items.map((transfer) => (
            <li key={transfer.transferId}>
              <div className="admin__row" style={{ cursor: 'default' }}>
                <div className="admin__row-top">
                  <span className="admin__row-title">
                    {transferTitle(balanceToToman(transfer.amountToman))}
                  </span>
                </div>
                <div className="admin__row-meta">
                  از {displayUsername(transfer.sender)} به {displayUsername(transfer.recipient)}
                </div>
                <div className="admin__row-meta">{formatFaDateLong(transfer.createdAt)}</div>
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
