import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Notification } from '../components/Notification'
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
import './AdminUsers.css'

function roleLabel(role: UserRole) {
  if (role === 'supervisor') return 'سوپروایزر'
  if (role === 'admin') return 'ادمین'
  return 'کاربر'
}

function UserMeta({ item, balance }: { item: AppUser; balance: number }) {
  const parts: Array<{ key: string; ltr?: boolean; content: string }> = []

  if (item.username) {
    parts.push({ key: 'username', ltr: true, content: `@${item.username}` })
  }
  parts.push({ key: 'id', ltr: true, content: String(item.telegramId) })
  parts.push({
    key: 'balance',
    content: `${balance.toLocaleString('fa-IR')} تومان`,
  })
  if (item.isPremium) {
    parts.push({ key: 'premium', content: 'پریمیوم' })
  }

  return (
    <div className="admin-user-item__meta">
      {parts.map((part, index) => (
        <span key={part.key} className="admin-user-item__meta-group">
          {index > 0 ? (
            <span className="admin-user-item__meta-dot" aria-hidden>
              ·
            </span>
          ) : null}
          <span
            className={`admin-user-item__meta-part${
              part.ltr ? ' admin-user-item__meta-part--ltr' : ''
            }`}
          >
            {part.content}
          </span>
        </span>
      ))}
    </div>
  )
}

function UserItemSkeleton({ index }: { index: number }) {
  return (
    <div
      className="admin-user-item admin-user-item--skeleton shop-rise"
      style={{ '--rise-index': Math.min(index + 2, 8) } as CSSProperties}
      aria-hidden
    >
      <span className="admin-user-skel admin-user-skel--avatar" />
      <div className="admin-user-item__body">
        <span className="admin-user-skel admin-user-skel--name" />
        <span className="admin-user-skel admin-user-skel--sub" />
      </div>
      <span className="admin-user-item__chevron" aria-hidden />
    </div>
  )
}

export function AdminUsersPage() {
  const navigate = useNavigate()
  const { ready } = useAdminAccess()
  const { haptic } = useTelegram()
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  }>({ show: false, message: '', type: 'error' })

  const showNotification = (
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'error',
  ) => setNotification({ show: true, message, type })

  const load = useCallback(async (q = '') => {
    setLoading(true)
    try {
      setUsers(await fetchAdminUsers(q))
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'خطا در دریافت کاربران', 'error')
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
    void load(query.trim())
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
        <SolarIcon icon="solar:magnifer-linear" width={15} height={15} color="var(--text-muted)" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="نام، یوزرنیم، ایمیل یا آیدی..."
          aria-label="جستجوی کاربر"
        />
      </form>

      {loading ? (
        <div className="admin-users__list" aria-busy="true" aria-label="در حال بارگذاری">
          {[0, 1, 2, 3, 4].map((index) => (
            <UserItemSkeleton key={index} index={index} />
          ))}
        </div>
      ) : null}

      {!loading && users.length === 0 ? (
        <p className="admin-empty">کاربری یافت نشد</p>
      ) : null}

      {!loading && users.length > 0 ? (
        <div className="admin-users__list">
          {users.map((item, index) => {
            const displayName = formatUserDisplayName(item)
            const balance = balanceToToman(item.balance)

            return (
              <button
                key={item.id}
                type="button"
                className={`admin-user-item shop-rise admin-user-item--${item.role}${
                  item.isBanned ? ' admin-user-item--banned' : ''
                }`}
                style={{ '--rise-index': Math.min(index + 2, 8) } as CSSProperties}
                onClick={() => {
                  haptic('light')
                  navigate(`/admin/users/${item.telegramId}`)
                }}
              >
                <span className="admin-user-item__avatar" aria-hidden>
                  {(displayName.slice(0, 1) || 'ک').toUpperCase()}
                </span>

                <div className="admin-user-item__body">
                  <div className="admin-user-item__top">
                    <h3 className="admin-user-item__name">{displayName}</h3>
                    <span
                      className={`admin-user-item__badge admin-user-item__badge--${
                        item.isBanned ? 'banned' : item.role
                      }`}
                    >
                      {item.isBanned ? 'مسدود' : roleLabel(item.role)}
                    </span>
                  </div>
                  <UserMeta item={item} balance={balance} />
                </div>

                <span className="admin-user-item__chevron" aria-hidden>
                  <SolarIcon icon="solar:alt-arrow-left-linear" width={14} height={14} />
                </span>
              </button>
            )
          })}
        </div>
      ) : null}

      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification((prev) => ({ ...prev, show: false }))}
      />
    </div>
  )
}
