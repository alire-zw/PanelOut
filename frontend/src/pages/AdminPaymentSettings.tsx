import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { Notification } from '../components/Notification'
import { PageHeader } from '../components/PageHeader'
import { useAdminAccess } from '../hooks/useAdminAccess'
import { useTelegram } from '../hooks/useTelegram'
import {
  fetchAdminPaymentSettings,
  updateAdminPaymentSettings,
  type PaymentSettings,
} from '../lib/paymentsApi'
import { isTelegramWebApp } from '../lib/telegram'
import '../styles/shop-rise.css'
import './AdminPaymentSettings.css'

export function AdminPaymentSettingsPage() {
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const { ready, allowed } = useAdminAccess()
  const [settings, setSettings] = useState<PaymentSettings | null>(null)
  const [masterWallet, setMasterWallet] = useState('')
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [saving, setSaving] = useState(false)
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
    void fetchAdminPaymentSettings()
      .then((data) => {
        if (cancelled) return
        setSettings(data)
        setMasterWallet(data.masterWalletAddress ?? '')
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

  const toggleTron = async () => {
    if (!settings || toggling || saving) return
    if (!settings.tronConfigured) {
      haptic('light')
      setNotification({
        show: true,
        message: 'کلید TRONGRID و SwapWallet در سرور تنظیم نشده',
        type: 'error',
      })
      return
    }
    haptic('light')
    setToggling(true)
    try {
      const next = await updateAdminPaymentSettings({ tronEnabled: !settings.tronEnabled })
      setSettings(next)
      setNotification({
        show: true,
        message: next.tronEnabled ? 'پرداخت ترون فعال شد' : 'پرداخت ترون غیرفعال شد',
        type: 'success',
      })
    } catch (err) {
      setNotification({
        show: true,
        message: err instanceof Error ? err.message : 'ذخیره ناموفق بود',
        type: 'error',
      })
    } finally {
      setToggling(false)
    }
  }

  const saveMasterWallet = async () => {
    if (saving || toggling) return
    haptic('light')
    setSaving(true)
    try {
      const next = await updateAdminPaymentSettings({
        masterWalletAddress: masterWallet.trim() || null,
      })
      setSettings(next)
      setMasterWallet(next.masterWalletAddress ?? '')
      setNotification({ show: true, message: 'آدرس کیف اصلی ذخیره شد', type: 'success' })
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

  const tronEnabled = Boolean(settings?.tronEnabled)
  const tronConfigured = Boolean(settings?.tronConfigured)

  return (
    <div className="admin-tron">
      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title="پرداخت ترون" onBack={handleBack} />
      </div>

      <div className="admin-tron__content">
        <h2 className="admin-tron__section-title shop-rise" style={{ '--rise-index': 1 } as CSSProperties}>
          وضعیت سرویس
        </h2>

        {loading ? (
          <div
            className="admin-tron__card admin-tron__card--skeleton shop-rise"
            style={{ '--rise-index': 2 } as CSSProperties}
            aria-hidden="true"
          >
            <div className="admin-tron__row">
              <div className="admin-tron__copy">
                <span className="admin-tron__skel admin-tron__skel--title" />
                <span className="admin-tron__skel admin-tron__skel--hint" />
              </div>
              <span className="admin-tron__skel admin-tron__skel--switch" />
            </div>
          </div>
        ) : (
          <div className="admin-tron__card shop-rise" style={{ '--rise-index': 2 } as CSSProperties}>
            <div className="admin-tron__row">
              <div className="admin-tron__copy">
                <span className="admin-tron__label">پرداخت TRX</span>
                <span className="admin-tron__hint">
                  {tronConfigured
                    ? tronEnabled
                      ? 'در شارژ کیف پول نمایش داده می‌شود'
                      : 'در شارژ کیف پول مخفی است'
                    : 'کلید سرور تنظیم نشده'}
                </span>
              </div>
              <button
                type="button"
                className={`admin-tron__switch${tronEnabled ? ' is-on' : ''}`}
                onClick={() => void toggleTron()}
                disabled={toggling || !tronConfigured}
                aria-pressed={tronEnabled}
                aria-label={tronEnabled ? 'غیرفعال کردن' : 'فعال کردن'}
              >
                <span className="admin-tron__switch-thumb" />
              </button>
            </div>
          </div>
        )}

        <h2
          className="admin-tron__section-title shop-rise"
          style={{ '--rise-index': 3, marginTop: 16 } as CSSProperties}
        >
          کیف پول اصلی
        </h2>

        {loading ? (
          <div
            className="admin-tron__card admin-tron__card--skeleton shop-rise"
            style={{ '--rise-index': 4 } as CSSProperties}
            aria-hidden="true"
          >
            <div className="admin-tron__field">
              <span className="admin-tron__skel admin-tron__skel--label" />
              <span className="admin-tron__skel admin-tron__skel--input" />
            </div>
            <span className="admin-tron__skel admin-tron__skel--note" />
            <span className="admin-tron__skel admin-tron__skel--btn" />
          </div>
        ) : (
          <div className="admin-tron__card shop-rise" style={{ '--rise-index': 4 } as CSSProperties}>
            <div className="admin-tron__field">
              <label className="admin-tron__field-label" htmlFor="master-wallet">
                آدرس Sweep
              </label>
              <input
                id="master-wallet"
                className="admin-tron__input"
                value={masterWallet}
                onChange={(event) => setMasterWallet(event.target.value)}
                placeholder="T..."
                dir="ltr"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <p className="admin-tron__note">واریزهای TRX پس از تأیید به این آدرس منتقل می‌شوند.</p>
            <button
              type="button"
              className="admin-tron__save"
              onClick={() => void saveMasterWallet()}
              disabled={saving}
            >
              {saving ? 'در حال ذخیره…' : 'ذخیره آدرس'}
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
