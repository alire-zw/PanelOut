import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { EmptyState } from '../../components/EmptyState'
import { useAdminAccess } from '../../hooks/useAdminAccess'
import { useTelegram } from '../../hooks/useTelegram'
import { fetchAdminUsers } from '../../lib/adminApi'
import { balanceToToman, formatUserDisplayName } from '../../lib/api'
import type { AppUser, UserRole } from '../../types/user'
import { formatFaNumber, roleLabel } from './adminLabels'
import { AdminScreen } from './AdminScreen'

const ROLE_FILTERS: Array<{ value: UserRole | 'all'; label: string }> = [
  { value: 'all', label: 'همه' },
  { value: 'user', label: 'کاربر' },
  { value: 'supervisor', label: 'سوپروایزر' },
  { value: 'admin', label: 'ادمین' },
]

function userInitial(user: AppUser): string {
  const name = formatUserDisplayName(user).trim()
  return name.slice(0, 1) || 'ک'
}

export function AdminUsersPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { haptic } = useTelegram()
  const { ready, allowed } = useAdminAccess()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [role, setRole] = useState<UserRole | 'all'>('all')
  const [bannedOnly, setBannedOnly] = useState(searchParams.get('banned') === '1')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<AppUser[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  }>({ show: false, message: '', type: 'error' })

  useEffect(() => {
    setBannedOnly(searchParams.get('banned') === '1')
  }, [searchParams])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, role, bannedOnly])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetchAdminUsers({
        page,
        limit: 20,
        search: debouncedSearch || undefined,
        role: role === 'all' ? undefined : role,
        isBanned: bannedOnly ? true : undefined,
      })
      setItems(result.items)
      setTotalPages(result.totalPages)
      setTotal(result.total)
    } catch (error) {
      setNotification({
        show: true,
        message: error instanceof Error ? error.message : 'خطا در دریافت کاربران',
        type: 'error',
      })
    } finally {
      setLoading(false)
    }
  }, [bannedOnly, debouncedSearch, page, role])

  useEffect(() => {
    if (!ready || !allowed) return
    void load()
  }, [allowed, load, ready])

  const handleBack = useCallback(() => navigate('/admin', { replace: true }), [navigate])

  if (!ready || !allowed) return null

  return (
    <AdminScreen
      sticky
      title={bannedOnly ? 'کاربران بن‌شده' : 'کاربران'}
      eyebrow="مدیریت کاربران"
      meta={
        <div className="admin-hub__live">
          <span>{loading ? '…' : formatFaNumber(total)} نفر</span>
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
            placeholder="جستجو نام، یوزرنیم، آیدی تلگرام…"
          />
          <div className="admin__filters">
            {ROLE_FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                className={`admin__chip${role === item.value ? ' admin__chip--active' : ''}`}
                onClick={() => {
                  haptic('light')
                  setRole(item.value)
                }}
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              className={`admin__chip${bannedOnly ? ' admin__chip--active' : ''}`}
              onClick={() => {
                haptic('light')
                setBannedOnly((prev) => !prev)
              }}
            >
              بن‌شده
            </button>
          </div>
        </div>
      }
    >
      {loading ? (
        <p className="admin__muted">در حال بارگذاری…</p>
      ) : items.length === 0 ? (
        <EmptyState title="کاربری پیدا نشد" />
      ) : (
        <ul className="admin__list">
          {items.map((user) => (
            <li key={user.id}>
              <button
                type="button"
                className="admin-user-row"
                onClick={() => {
                  haptic('light')
                  navigate(`/admin/users/${user.id}`)
                }}
              >
                <span className="admin-user-row__avatar">{userInitial(user)}</span>
                <span className="admin-user-row__body">
                  <span className="admin-user-row__name">{formatUserDisplayName(user)}</span>
                  <span className="admin-user-row__meta">
                    {user.username ? `@${user.username}` : `#${user.id}`}
                    {' · '}
                    {roleLabel(user.role)}
                  </span>
                </span>
                <span className="admin-user-row__side">
                  <span className="admin-user-row__balance">
                    {formatFaNumber(balanceToToman(user.balance))}
                  </span>
                  <span className="admin-user-row__tags">
                    {user.isBanned && <span className="admin-user-tag admin-user-tag--danger">بن</span>}
                    {!user.kycVerifiedAt && (
                      <span className="admin-user-tag admin-user-tag--warn">KYC</span>
                    )}
                    {user.kycVerifiedAt && !user.isBanned && (
                      <span className="admin-user-tag">OK</span>
                    )}
                  </span>
                </span>
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
