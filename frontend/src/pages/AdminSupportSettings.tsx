import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { Notification } from '../components/Notification'
import { PageHeader } from '../components/PageHeader'
import { useAdminAccess } from '../hooks/useAdminAccess'
import { useTelegram } from '../hooks/useTelegram'
import {
  fetchSupportContactSetting,
  updateSupportContactSetting,
} from '../lib/adminSupportApi'
import { isTelegramWebApp } from '../lib/telegram'
import '../styles/shop-rise.css'
import './Admin.css'
import './AdminSupportSettings.css'

function normalizeUsername(value: string) {
  return value
    .replace(/^@+/, '')
    .replace(/^https?:\/\/(t\.me|telegram\.me)\//i, '')
    .replace(/\/.*$/, '')
}

export function AdminSupportSettingsPage() {
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const { ready, allowed } = useAdminAccess()
  const [username, setUsername] = useState('')
  const [savedUsername, setSavedUsername] = useState<string | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error'
  }>({ show: false, message: '', type: 'success' })

  const handleBack = useCallback(() => {
    navigate('/admin', { replace: true })
  }, [navigate])

  useEffect(() => {
    if (!ready || !allowed) return
    let cancelled = false
    void fetchSupportContactSetting()
      .then((data) => {
        if (cancelled) return
        setUsername(data.telegramUsername ?? '')
        setSavedUsername(data.telegramUsername)
        setEnabled(data.enabled)
      })
      .catch((err) => {
        if (!cancelled) {
          setNotification({
            show: true,
            message: err instanceof Error ? err.message : 'خطا در دریافت تنظیمات',
            type: 'error',
          })
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [allowed, ready])

  useEffect(() => {
    if (!isTelegramWebApp()) return
    const backButton = window.Telegram?.WebApp.BackButton
    if (!backButton) return
    backButton.show()
    backButton.onClick(handleBack)
    return () => {
      backButton.hide()
      backButton.offClick(handleBack)
    }
  }, [handleBack])

  if (!ready || !allowed) return null

  const applySettings = (data: { telegramUsername: string | null; enabled: boolean }) => {
    setUsername(data.telegramUsername ?? '')
    setSavedUsername(data.telegramUsername)
    setEnabled(data.enabled)
  }

  const handleToggle = async () => {
    if (toggling || saving) return
    if (!enabled && !savedUsername && !username.trim()) {
      haptic('light')
      setNotification({
        show: true,
        message: 'اول آیدی تلگرام را ذخیره کنید',
        type: 'error',
      })
      return
    }
    haptic('light')
    setToggling(true)
    try {
      const next = await updateSupportContactSetting({ enabled: !enabled })
      applySettings(next)
      setNotification({
        show: true,
        message: next.enabled ? 'گفتگو با کارشناس فعال شد' : 'گفتگو با کارشناس غیرفعال شد',
        type: 'success',
      })
    } catch (err) {
      setNotification({
        show: true,
        message: err instanceof Error ? err.message : 'تغییر وضعیت ناموفق بود',
        type: 'error',
      })
    } finally {
      setToggling(false)
    }
  }

  const handleSave = async () => {
    if (saving || toggling) return
    haptic('light')
    setSaving(true)
    try {
      const next = await updateSupportContactSetting({ telegramUsername: username.trim() })
      applySettings(next)
      setNotification({
        show: true,
        message: next.telegramUsername ? `آیدی ذخیره شد: @${next.telegramUsername}` : 'آیدی حذف شد',
        type: 'success',
      })
    } catch (err) {
      setNotification({
        show: true,
        message: err instanceof Error ? err.message : 'ذخیره ناموفق بود',
        type: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="admin-support">
      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title="گفتگو با کارشناس" onBack={handleBack} />
      </div>

      <div className="admin-support__content">
        <h2 className="admin-support__section-title shop-rise" style={{ '--rise-index': 1 } as CSSProperties}>
          پشتیبانی مستقیم
        </h2>

        {loading ? (
          <div
            className="admin-support__card admin-support__card--skeleton shop-rise"
            style={{ '--rise-index': 2 } as CSSProperties}
            aria-hidden="true"
          >
            <div className="admin-support__row">
              <div className="admin-support__copy">
                <span className="admin-support__skel admin-support__skel--title" />
                <span className="admin-support__skel admin-support__skel--hint" />
              </div>
              <span className="admin-support__skel admin-support__skel--switch" />
            </div>
            <div className="admin-support__field">
              <span className="admin-support__skel admin-support__skel--label" />
              <span className="admin-support__skel admin-support__skel--input" />
            </div>
            <span className="admin-support__skel admin-support__skel--btn" />
          </div>
        ) : (
          <div className="admin-support__card shop-rise" style={{ '--rise-index': 2 } as CSSProperties}>
            <div className="admin-support__row">
              <div className="admin-support__copy">
                <span className="admin-support__label">گفتگوی مستقیم</span>
                <span className="admin-support__hint">
                  {enabled && savedUsername
                    ? `@${savedUsername}`
                    : 'در صفحه پشتیبانی نمایش داده نشود'}
                </span>
              </div>
              <button
                type="button"
                className={`admin-support__switch${enabled ? ' is-on' : ''}`}
                onClick={() => void handleToggle()}
                disabled={toggling}
                aria-pressed={enabled}
                aria-label={enabled ? 'غیرفعال کردن' : 'فعال کردن'}
              >
                <span className="admin-support__switch-thumb" />
              </button>
            </div>

            <div className="admin-support__field">
              <label className="admin-support__field-label" htmlFor="support-telegram-username">
                آیدی تلگرام
              </label>
              <div className="admin-support__input-wrap">
                <span className="admin-support__at">@</span>
                <input
                  id="support-telegram-username"
                  className="admin-support__input"
                  value={username}
                  onChange={(event) => setUsername(normalizeUsername(event.target.value))}
                  placeholder="PanelOut_Support"
                  dir="ltr"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            </div>

            <button
              type="button"
              className="admin-support__save"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? 'در حال ذخیره…' : 'ذخیره آیدی'}
            </button>
          </div>
        )}
      </div>

      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification((prev) => ({ ...prev, show: false }))}
      />
    </div>
  )
}
