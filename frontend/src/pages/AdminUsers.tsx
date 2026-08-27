import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { SolarIcon } from '../components/SolarIcon'
import { useAdminAccess } from '../hooks/useAdminAccess'
import { useTelegram } from '../hooks/useTelegram'
import { balanceToToman, formatUserDisplayName } from '../lib/api'
import { fetchAdminUsers } from '../lib/paymentsApi'
import { isTelegramWebApp } from '../lib/telegram'
import type { AppUser, UserRole } from '../types/user'
import '../styles/shop-rise.css'
import './Admin.css'

function roleLabel(role: UserRole) {
  if (role === 'supervisor') return 'سوپروایزر'
  if (role === 'admin') return 'ادمین'
  return 'کاربر'
}

export function AdminUsersPage() {
  const navigate = useNavigate()
  const { ready } = useAdminAccess()
  const { haptic } = useTelegram()
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (q = '') => {
    setLoading(true)
    setError(null)
    try {
      setUsers(await fetchAdminUsers(q))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در دریافت کاربران')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    void load()
  }, [ready, load])

  useEffect(() => {
    if (!isTelegramWebApp()) return
    const backButton = window.Telegram?.WebApp.BackButton
    if (!backButton) return
    const handleBack = () => navigate('/admin')
    backButton.show()
    backButton.onClick(handleBack)
    return () => {
      backButton.hide()
      backButton.offClick(handleBack)
    }
  }, [navigate])

  const handleSearch = (event: FormEvent) => {
    event.preventDefault()
    haptic('light')
    void load(query)
  }

  if (!ready) return null

  return (
    <div className="admin-section">
      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title="کاربران" onBack={() => navigate('/admin')} />
      </div>

      <form
        className="admin-users__search shop-rise"
        style={{ '--rise-index': 1 } as CSSProperties}
        onSubmit={handleSearch}
      >
        <SolarIcon icon="solar:magnifer-linear" width={18} height={18} color="var(--text-muted)" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="جستجو با نام، یوزرنیم، ایمیل یا آیدی..."
          dir="rtl"
        />
        <button type="submit">جستجو</button>
      </form>

      {loading ? <p className="admin-status">در حال بارگذاری...</p> : null}
      {error ? <p className="admin-status admin-status--error">{error}</p> : null}
      {!loading && !error && users.length === 0 ? (
        <p className="admin-empty">کاربری یافت نشد</p>
      ) : null}

      <div className="admin-users__list">
        {users.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className="admin-user-row shop-rise"
            style={{ '--rise-index': Math.min(index + 2, 8) } as CSSProperties}
            onClick={() => {
              haptic('light')
              navigate(`/admin/users/${item.telegramId}`)
            }}
          >
            <span className="admin-user-row__avatar" aria-hidden>
              {(formatUserDisplayName(item).slice(0, 1) || 'ک').toUpperCase()}
            </span>
            <span className="admin-user-row__body">
              <span className="admin-user-row__name">{formatUserDisplayName(item)}</span>
              <span className="admin-user-row__meta">
                {item.username ? `@${item.username}` : `ID ${item.telegramId}`}
                {' · '}
                {balanceToToman(item.balance).toLocaleString('fa-IR')} تومان
              </span>
            </span>
            <span className={`admin-user-row__role admin-user-row__role--${item.role}`}>
              {roleLabel(item.role)}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
