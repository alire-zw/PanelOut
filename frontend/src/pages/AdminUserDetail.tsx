import { useEffect, useState, type CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { useAdminAccess } from '../hooks/useAdminAccess'
import { balanceToToman, formatUserDisplayName } from '../lib/api'
import { fetchAdminUser } from '../lib/paymentsApi'
import { isTelegramWebApp } from '../lib/telegram'
import type { AppUser, UserRole } from '../types/user'
import '../styles/shop-rise.css'
import './Admin.css'

function roleLabel(role: UserRole) {
  if (role === 'supervisor') return 'سوپروایزر'
  if (role === 'admin') return 'ادمین'
  return 'کاربر'
}

export function AdminUserDetailPage() {
  const navigate = useNavigate()
  const { telegramId } = useParams()
  const { ready } = useAdminAccess()
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const id = Number(telegramId)

  useEffect(() => {
    if (!ready || !Number.isFinite(id) || id <= 0) return
    let cancelled = false
    setLoading(true)
    void fetchAdminUser(id)
      .then((next) => {
        if (!cancelled) {
          setUser(next)
          setError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setUser(null)
          setError(err instanceof Error ? err.message : 'خطا در دریافت کاربر')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [ready, id])

  useEffect(() => {
    if (!isTelegramWebApp()) return
    const backButton = window.Telegram?.WebApp.BackButton
    if (!backButton) return
    const handleBack = () => navigate('/admin/users')
    backButton.show()
    backButton.onClick(handleBack)
    return () => {
      backButton.hide()
      backButton.offClick(handleBack)
    }
  }, [navigate])

  if (!ready) return null

  return (
    <div className="admin-section">
      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title="اطلاعات کاربر" onBack={() => navigate('/admin/users')} />
      </div>

      {loading ? <p className="admin-status">در حال بارگذاری...</p> : null}
      {error ? <p className="admin-status admin-status--error">{error}</p> : null}

      {user ? (
        <>
          <section
            className="admin-user-detail__hero shop-rise"
            style={{ '--rise-index': 1 } as CSSProperties}
          >
            <div className="admin-user-detail__avatar" aria-hidden>
              {(formatUserDisplayName(user).slice(0, 1) || 'ک').toUpperCase()}
            </div>
            <div>
              <h2 className="admin-user-detail__name">{formatUserDisplayName(user)}</h2>
              <p className="admin-user-detail__handle">
                {user.username ? `@${user.username}` : `Telegram ${user.telegramId}`}
              </p>
            </div>
            <span className={`admin-user-row__role admin-user-row__role--${user.role}`}>
              {roleLabel(user.role)}
            </span>
          </section>

          <section
            className="admin-user-detail__balance shop-rise"
            style={{ '--rise-index': 2 } as CSSProperties}
          >
            <span className="admin-user-detail__balance-label">موجودی کیف پول</span>
            <strong className="admin-user-detail__balance-value">
              {balanceToToman(user.balance).toLocaleString('fa-IR')}
              <span>تومان</span>
            </strong>
          </section>

          <section
            className="admin-user-detail__grid shop-rise"
            style={{ '--rise-index': 3 } as CSSProperties}
          >
            <div className="admin-user-detail__field">
              <span>نام کامل</span>
              <strong>{user.realName || '—'}</strong>
            </div>
            <div className="admin-user-detail__field">
              <span>نام تلگرام</span>
              <strong>{user.telegramName || '—'}</strong>
            </div>
            <div className="admin-user-detail__field">
              <span>ایمیل</span>
              <strong>{user.email || '—'}</strong>
            </div>
            <div className="admin-user-detail__field">
              <span>شناسه تلگرام</span>
              <strong dir="ltr">{user.telegramId}</strong>
            </div>
            <div className="admin-user-detail__field">
              <span>شناسه داخلی</span>
              <strong dir="ltr">{user.id}</strong>
            </div>
            <div className="admin-user-detail__field">
              <span>وضعیت</span>
              <strong className={user.isBanned ? 'is-danger' : 'is-success'}>
                {user.isBanned ? 'مسدود' : 'فعال'}
              </strong>
            </div>
            <div className="admin-user-detail__field">
              <span>پریمیوم</span>
              <strong>{user.isPremium ? 'بله' : 'خیر'}</strong>
            </div>
            <div className="admin-user-detail__field">
              <span>تاریخ عضویت</span>
              <strong>
                {user.createdAt
                  ? new Date(user.createdAt).toLocaleDateString('fa-IR')
                  : '—'}
              </strong>
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
