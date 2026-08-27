import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAdminAccess } from '../../hooks/useAdminAccess'
import { useTelegram } from '../../hooks/useTelegram'
import { useUser } from '../../context/UserContext'
import { fetchAdminUser, updateAdminUser } from '../../lib/adminApi'
import { balanceToToman, formatUserDisplayName } from '../../lib/api'
import type { AppUser, UserRole } from '../../types/user'
import { formatFaDateLong, formatFaNumber, roleLabel } from './adminLabels'
import { AdminScreen } from './AdminScreen'

const ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: 'user', label: 'کاربر' },
  { value: 'supervisor', label: 'سوپروایزر' },
  { value: 'admin', label: 'ادمین' },
]

export function AdminUserDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const userId = Number.parseInt(id ?? '', 10)
  const { haptic } = useTelegram()
  const { user: actor } = useUser()
  const { ready, allowed } = useAdminAccess()
  const [user, setUser] = useState<AppUser | null>(null)
  const [balanceInput, setBalanceInput] = useState('')
  const [roleInput, setRoleInput] = useState<UserRole>('user')
  const [saving, setSaving] = useState(false)
  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  }>({ show: false, message: '', type: 'error' })

  const isDbAdmin = actor?.role === 'admin'

  const handleBack = useCallback(() => {
    navigate('/admin/users', { replace: true })
  }, [navigate])

  const load = useCallback(async () => {
    if (!Number.isFinite(userId)) return
    try {
      const result = await fetchAdminUser(userId)
      setUser(result.user)
      setBalanceInput(String(balanceToToman(result.user.balance)))
      setRoleInput(result.user.role)
    } catch (error) {
      setNotification({
        show: true,
        message: error instanceof Error ? error.message : 'خطا در دریافت کاربر',
        type: 'error',
      })
    }
  }, [userId])

  useEffect(() => {
    if (!ready || !allowed) return
    void load()
  }, [allowed, load, ready])

  const showMessage = (message: string, type: 'success' | 'error' | 'warning' | 'info') => {
    setNotification({ show: true, message, type })
  }

  const applyUpdate = async (
    body: Parameters<typeof updateAdminUser>[1],
    successMessage: string,
  ) => {
    if (!user) return
    setSaving(true)
    try {
      const result = await updateAdminUser(user.id, body)
      setUser(result.user)
      setBalanceInput(String(balanceToToman(result.user.balance)))
      setRoleInput(result.user.role)
      haptic('medium')
      showMessage(successMessage, 'success')
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'خطا در ذخیره', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!ready || !allowed) return null

  const initial = user ? formatUserDisplayName(user).trim().slice(0, 1) || 'ک' : '…'
  const roleDirty = user ? roleInput !== user.role : false
  const balanceDirty = user
    ? balanceInput !== String(balanceToToman(user.balance))
    : false

  return (
    <AdminScreen
      title={user ? formatUserDisplayName(user) : 'جزئیات کاربر'}
      eyebrow="مدیریت کاربران"
      onBack={handleBack}
      notification={notification}
      onCloseNotification={() => setNotification((prev) => ({ ...prev, show: false }))}
    >
      {!user ? (
        <p className="admin__muted">در حال بارگذاری…</p>
      ) : (
        <>
          <section className="admin-profile">
            <div className="admin-profile__head">
              <span className="admin-profile__avatar">{initial}</span>
              <div className="admin-profile__identity">
                <h2 className="admin-profile__name">{formatUserDisplayName(user)}</h2>
                <p className="admin-profile__handle">
                  {user.username ? `@${user.username}` : `شناسه ${formatFaNumber(user.id)}`}
                  {' · '}
                  {roleLabel(user.role)}
                </p>
              </div>
            </div>

            <div className="admin-profile__stats">
              <div className="admin-profile__stat">
                <span className="admin-profile__stat-label">موجودی</span>
                <span className="admin-profile__stat-value">
                  {formatFaNumber(balanceToToman(user.balance))}
                </span>
              </div>
              <div className="admin-profile__stat">
                <span className="admin-profile__stat-label">کلاب</span>
                <span className="admin-profile__stat-value">
                  {formatFaNumber(user.clubPoints)}
                </span>
              </div>
              <div className="admin-profile__stat">
                <span className="admin-profile__stat-label">تلگرام</span>
                <span className="admin-profile__stat-value">{user.telegramId}</span>
              </div>
              <div className="admin-profile__stat">
                <span className="admin-profile__stat-label">وضعیت</span>
                <span
                  className={`admin-profile__stat-value admin-profile__stat-value--text${
                    user.isBanned ? ' is-danger' : ''
                  }`}
                >
                  {user.isBanned ? 'بن‌شده' : user.isActive ? 'فعال' : 'غیرفعال'}
                </span>
              </div>
              <div className="admin-profile__stat">
                <span className="admin-profile__stat-label">احراز</span>
                <span
                  className={`admin-profile__stat-value admin-profile__stat-value--text${
                    user.kycVerifiedAt ? '' : ' is-warn'
                  }`}
                >
                  {user.kycVerifiedAt ? 'تأیید شده' : 'ناقص'}
                </span>
              </div>
              <div className="admin-profile__stat">
                <span className="admin-profile__stat-label">موبایل</span>
                <span
                  className="admin-profile__stat-value"
                  dir="ltr"
                  style={{ textAlign: 'right' }}
                >
                  {user.phoneNumber ?? '—'}
                </span>
              </div>
            </div>
            {user.kycVerifiedAt && (
              <p className="admin-profile__kyc-date">
                تاریخ KYC: {formatFaDateLong(user.kycVerifiedAt)}
              </p>
            )}
          </section>

          <div className="admin-ops">
            <h3 className="admin-ops__title">عملیات سریع</h3>
            <div className="admin-ops__grid">
              <button
                type="button"
                className={`admin-ops__tile${user.isBanned ? ' admin-ops__tile--teal' : ' admin-ops__tile--danger'}`}
                disabled={saving}
                onClick={() => {
                  const next = !user.isBanned
                  if (!window.confirm(next ? 'این کاربر بن شود؟' : 'بن کاربر برداشته شود؟')) return
                  void applyUpdate({ isBanned: next }, next ? 'کاربر بن شد' : 'بن برداشته شد')
                }}
              >
                <span className="admin-ops__tile-label">
                  {user.isBanned ? 'برداشتن بن' : 'بن کردن'}
                </span>
                <span className="admin-ops__tile-hint">دسترسی ورود</span>
              </button>

              <button
                type="button"
                className="admin-ops__tile admin-ops__tile--amber"
                disabled={saving}
                onClick={() => {
                  const next = !user.isActive
                  if (!window.confirm(next ? 'کاربر فعال شود؟' : 'کاربر غیرفعال شود؟')) return
                  void applyUpdate({ isActive: next }, next ? 'کاربر فعال شد' : 'کاربر غیرفعال شد')
                }}
              >
                <span className="admin-ops__tile-label">
                  {user.isActive ? 'غیرفعال' : 'فعال‌سازی'}
                </span>
                <span className="admin-ops__tile-hint">وضعیت حساب</span>
              </button>

              <button
                type="button"
                className={`admin-ops__tile${user.kycVerifiedAt ? ' admin-ops__tile--amber' : ' admin-ops__tile--teal'}`}
                disabled={saving}
                onClick={() => {
                  const next = !user.kycVerifiedAt
                  if (
                    !window.confirm(
                      next
                        ? 'این کاربر دستی احراز شود و دیگر نیاز به KYC نداشته باشد؟'
                        : 'احراز دستی برداشته شود؟ کاربر باید دوباره احراز کند.',
                    )
                  ) {
                    return
                  }
                  void applyUpdate(
                    { kycVerified: next },
                    next ? 'کاربر دستی احراز شد' : 'احراز دستی برداشته شد',
                  )
                }}
              >
                <span className="admin-ops__tile-label">
                  {user.kycVerifiedAt ? 'لغو احراز دستی' : 'احراز دستی'}
                </span>
                <span className="admin-ops__tile-hint">بدون نیاز به KYC</span>
              </button>
            </div>

            {isDbAdmin && (
              <>
                <h3 className="admin-ops__title">سطح دسترسی</h3>
                <div className="admin-edit">
                  <div className="admin-edit__seg">
                    {ROLE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`admin-edit__seg-btn${roleInput === option.value ? ' is-active' : ''}`}
                        disabled={saving}
                        onClick={() => {
                          haptic('light')
                          setRoleInput(option.value)
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="admin__btn admin__btn--ghost"
                    disabled={saving || !roleDirty}
                    onClick={() => {
                      if (!window.confirm(`نقش به «${roleLabel(roleInput)}» تغییر کند؟`)) return
                      void applyUpdate({ role: roleInput }, 'نقش به‌روز شد')
                    }}
                  >
                    {roleDirty ? `اعمال نقش «${roleLabel(roleInput)}»` : 'نقش فعلی ذخیره است'}
                  </button>
                </div>

                <h3 className="admin-ops__title">موجودی کیف پول</h3>
                <div className="admin-edit">
                  <p className="admin-edit__hint">
                    موجودی فعلی:{' '}
                    <strong>{formatFaNumber(balanceToToman(user.balance))} تومان</strong>
                  </p>
                  <div className="admin-edit__balance">
                    <input
                      className="admin-edit__input"
                      value={balanceInput}
                      onChange={(event) =>
                        setBalanceInput(event.target.value.replace(/[^\d]/g, ''))
                      }
                      inputMode="numeric"
                      placeholder="۰"
                    />
                    <span className="admin-edit__unit">تومان</span>
                  </div>
                  <button
                    type="button"
                    className="admin__btn"
                    disabled={saving || !balanceInput || !balanceDirty}
                    onClick={() => {
                      const amount = Number(balanceInput)
                      if (!Number.isFinite(amount) || amount < 0) {
                        showMessage('مبلغ نامعتبر است', 'warning')
                        return
                      }
                      if (!window.confirm(`موجودی به ${formatFaNumber(amount)} تومان تنظیم شود؟`)) {
                        return
                      }
                      void applyUpdate({ balance: amount }, 'موجودی به‌روز شد')
                    }}
                  >
                    {balanceDirty ? 'ذخیره موجودی جدید' : 'بدون تغییر'}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </AdminScreen>
  )
}
