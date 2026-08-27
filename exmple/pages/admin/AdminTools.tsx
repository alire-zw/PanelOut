import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminAccess } from '../../hooks/useAdminAccess'
import { useTelegram } from '../../hooks/useTelegram'
import {
  fetchAdminHealth,
  fetchAdminSupportContact,
  inquiryAdminPayment,
  syncAllClubPoints,
  updateAdminSupportContact,
} from '../../lib/adminApi'
import { formatFaNumber } from './adminLabels'
import { AdminScreen } from './AdminScreen'

export function AdminToolsPage() {
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const { ready, allowed } = useAdminAccess()
  const [trackId, setTrackId] = useState('')
  const [inquiring, setInquiring] = useState(false)
  const [inquiryResult, setInquiryResult] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [health, setHealth] = useState<string | null>(null)
  const [supportUsername, setSupportUsername] = useState('')
  const [savingSupport, setSavingSupport] = useState(false)
  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  }>({ show: false, message: '', type: 'error' })

  const handleBack = useCallback(() => navigate('/admin', { replace: true }), [navigate])

  useEffect(() => {
    if (!ready || !allowed) return
    void fetchAdminHealth()
      .then((result) => setHealth(JSON.stringify(result)))
      .catch(() => setHealth(null))
    void fetchAdminSupportContact()
      .then((result) => setSupportUsername(result.telegramUsername ?? ''))
      .catch(() => setSupportUsername(''))
  }, [allowed, ready])

  if (!ready || !allowed) return null

  return (
    <AdminScreen
      title="ابزارها"
      eyebrow="سیستم"
      onBack={handleBack}
      notification={notification}
      onCloseNotification={() => setNotification((prev) => ({ ...prev, show: false }))}
    >
      <div className="admin__card">
        <h2 className="admin__menu-title" style={{ padding: 0, marginTop: 0 }}>
          پشتیبانی مستقیم
        </h2>
        <label className="admin__field">
          <span className="admin__field-label">آیدی تلگرام پشتیبانی</span>
          <input
            className="admin__input"
            value={supportUsername}
            onChange={(event) => setSupportUsername(event.target.value.replace(/^@+/, ''))}
            placeholder="مثلاً ViralTelSupport"
            dir="ltr"
            style={{ textAlign: 'left' }}
          />
        </label>
        <p className="admin__muted" style={{ margin: '0 0 10px' }}>
          در صفحه پشتیبانی کاربر دکمه «گفتگوی مستقیم» به این آیدی وصل می‌شود. خالی بگذارید تا دکمه
          مخفی شود.
        </p>
        <button
          type="button"
          className="admin__btn"
          disabled={savingSupport}
          onClick={() => {
            void (async () => {
              setSavingSupport(true)
              try {
                const result = await updateAdminSupportContact(supportUsername.trim())
                setSupportUsername(result.telegramUsername ?? '')
                haptic('medium')
                setNotification({
                  show: true,
                  message: result.telegramUsername
                    ? `ذخیره شد: @${result.telegramUsername}`
                    : 'آیدی پشتیبانی حذف شد',
                  type: 'success',
                })
              } catch (error) {
                setNotification({
                  show: true,
                  message: error instanceof Error ? error.message : 'خطا در ذخیره',
                  type: 'error',
                })
              } finally {
                setSavingSupport(false)
              }
            })()
          }}
        >
          {savingSupport ? 'در حال ذخیره…' : 'ذخیره آیدی پشتیبانی'}
        </button>
      </div>

      <div className="admin__card">
        <div className="admin__field">
          <span className="admin__field-label">وضعیت سرور</span>
          <span className="admin__field-value">{health ? 'در دسترس' : 'نامشخص'}</span>
        </div>
        {health && <pre className="admin__pre">{health}</pre>}
      </div>

      <div className="admin__card">
        <div className="admin__field">
          <span className="admin__field-label">استعلام زیبال (Track ID)</span>
          <input
            className="admin__input"
            value={trackId}
            onChange={(event) => setTrackId(event.target.value.replace(/[^\d]/g, ''))}
            inputMode="numeric"
            placeholder="مثلاً 123456789"
          />
        </div>
        <button
          type="button"
          className="admin__btn"
          disabled={inquiring}
          onClick={() => {
            void (async () => {
              if (!trackId.trim()) {
                setNotification({ show: true, message: 'Track ID را وارد کنید', type: 'warning' })
                return
              }
              setInquiring(true)
              try {
                const result = await inquiryAdminPayment(trackId.trim())
                haptic('medium')
                setInquiryResult(JSON.stringify(result.inquiry ?? result, null, 2))
                setNotification({ show: true, message: 'استعلام انجام شد', type: 'success' })
              } catch (error) {
                setNotification({
                  show: true,
                  message: error instanceof Error ? error.message : 'خطا در استعلام',
                  type: 'error',
                })
              } finally {
                setInquiring(false)
              }
            })()
          }}
        >
          {inquiring ? 'در حال استعلام…' : 'استعلام'}
        </button>
        {inquiryResult && <pre className="admin__pre">{inquiryResult}</pre>}
      </div>

      <div className="admin__card">
        <div className="admin__field">
          <span className="admin__field-label">همگام‌سازی کلاب پوینت</span>
          <span className="admin__field-value" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            هر ۱۰۰٬۰۰۰ تومان خرید موفق = ۱۰ امتیاز
          </span>
        </div>
        <button
          type="button"
          className="admin__btn admin__btn--ghost"
          disabled={syncing}
          onClick={() => {
            void (async () => {
              if (!window.confirm('همگام‌سازی همه کاربران انجام شود؟')) return
              setSyncing(true)
              try {
                const result = await syncAllClubPoints()
                haptic('medium')
                setNotification({
                  show: true,
                  message: `${formatFaNumber(result.updated)} کاربر به‌روز شد`,
                  type: 'success',
                })
              } catch (error) {
                setNotification({
                  show: true,
                  message: error instanceof Error ? error.message : 'خطا در همگام‌سازی',
                  type: 'error',
                })
              } finally {
                setSyncing(false)
              }
            })()
          }}
        >
          {syncing ? 'در حال همگام‌سازی…' : 'اجرای sync-all'}
        </button>
      </div>
    </AdminScreen>
  )
}
