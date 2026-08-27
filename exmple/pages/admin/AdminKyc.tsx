import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '../../components/EmptyState'
import { useAdminAccess } from '../../hooks/useAdminAccess'
import { useTelegram } from '../../hooks/useTelegram'
import { fetchAdminUsers } from '../../lib/adminApi'
import { formatUserDisplayName } from '../../lib/api'
import type { AppUser } from '../../types/user'
import { formatFaDate, formatFaNumber } from './adminLabels'
import { AdminScreen } from './AdminScreen'

export function AdminKycPage() {
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const { ready, allowed } = useAdminAccess()
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<AppUser[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  }>({ show: false, message: '', type: 'error' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetchAdminUsers({
        page,
        limit: 20,
        hasKyc: false,
        isActive: true,
      })
      setItems(result.items)
      setTotalPages(result.totalPages)
    } catch (error) {
      setNotification({
        show: true,
        message: error instanceof Error ? error.message : 'خطا در دریافت لیست KYC',
        type: 'error',
      })
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    if (!ready || !allowed) return
    void load()
  }, [allowed, load, ready])

  const handleBack = useCallback(() => navigate('/admin', { replace: true }), [navigate])

  if (!ready || !allowed) return null

  return (
    <AdminScreen
      sticky
      title="احراز هویت ناقص"
      eyebrow="مدیریت کاربران"
      onBack={handleBack}
      notification={notification}
      onCloseNotification={() => setNotification((prev) => ({ ...prev, show: false }))}
    >
      {loading ? (
        <p className="admin__muted">در حال بارگذاری…</p>
      ) : items.length === 0 ? (
        <EmptyState title="کاربر بدون KYC پیدا نشد" />
      ) : (
        <ul className="admin__list">
          {items.map((user) => (
            <li key={user.id}>
              <button
                type="button"
                className="admin__row"
                onClick={() => {
                  haptic('light')
                  navigate(`/admin/users/${user.id}`)
                }}
              >
                <div className="admin__row-top">
                  <span className="admin__row-title">{formatUserDisplayName(user)}</span>
                  <span className="admin__badge admin__badge--warn">ناقص</span>
                </div>
                <div className="admin__row-meta">
                  {user.phoneNumber ? `موبایل ثبت‌شده · ` : 'بدون موبایل · '}
                  {user.nationalId ? 'کد ملی دارد · ' : 'بدون کد ملی · '}
                  عضویت {formatFaDate(user.createdAt)}
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
