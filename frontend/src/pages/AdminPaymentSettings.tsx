import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { Notification } from '../components/Notification'
import { PageHeader } from '../components/PageHeader'
import DepositCryptoIcon from '../components/icons/DepositCryptoIcon'
import { useAdminAccess } from '../hooks/useAdminAccess'
import { useTelegram } from '../hooks/useTelegram'
import {
  fetchAdminPaymentSettings,
  updateAdminPaymentSettings,
  type PaymentSettings,
} from '../lib/paymentsApi'
import { isTelegramWebApp } from '../lib/telegram'
import '../styles/shop-rise.css'
import './Admin.css'

function AdminPaymentSettingsSkeleton() {
  return (
    <>
      {[0, 1].map((index) => (
        <section
          key={index}
          className="admin-payment-settings__card admin-payment-settings__card--skeleton shop-rise"
          style={{ '--rise-index': index + 1 } as CSSProperties}
          aria-hidden="true"
        >
          <div className="admin-payment-settings__skeleton-head">
            <span className="admin-payment-settings__skeleton-icon" />
            <span className="admin-payment-settings__skeleton-copy">
              <span className="admin-payment-settings__skeleton-line admin-payment-settings__skeleton-line--title" />
              <span className="admin-payment-settings__skeleton-line admin-payment-settings__skeleton-line--hint" />
            </span>
          </div>
          <span className="admin-payment-settings__skeleton-line admin-payment-settings__skeleton-line--action" />
        </section>
      ))}
    </>
  )
}

export function AdminPaymentSettingsPage() {
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const { ready, allowed } = useAdminAccess()
  const [settings, setSettings] = useState<PaymentSettings | null>(null)
  const [masterWallet, setMasterWallet] = useState('')
  const [loading, setLoading] = useState(true)
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
    if (!settings || saving) return
    haptic('light')
    setSaving(true)
    try {
      const next = await updateAdminPaymentSettings({ tronEnabled: !settings.tronEnabled })
      setSettings(next)
      setNotification({ show: true, message: 'تنظیمات ذخیره شد', type: 'success' })
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

  const saveMasterWallet = async () => {
    if (saving) return
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

  return (
    <div className="admin admin-page">
      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title="تنظیمات پرداخت ترون" onBack={handleBack} />
      </div>

      {loading ? (
        <AdminPaymentSettingsSkeleton />
      ) : (
        <>
          <section
            className="admin-payment-settings__card shop-rise"
            style={{ '--rise-index': 1 } as CSSProperties}
          >
            <div className="admin-payment-settings__head">
              <span className="admin-payment-settings__icon">
                <DepositCryptoIcon width={20} height={20} />
              </span>
              <div>
                <h2 className="admin-payment-settings__title">پرداخت TRX</h2>
                <p className="admin-payment-settings__hint">
                  {settings?.tronConfigured
                    ? 'سرویس ترون پیکربندی شده است'
                    : 'کلید TRONGRID و SwapWallet در سرور تنظیم نشده'}
                </p>
              </div>
            </div>

            <button
              type="button"
              className={`admin-payment-settings__toggle${
                settings?.tronEnabled ? ' admin-payment-settings__toggle--on' : ''
              }`}
              onClick={() => void toggleTron()}
              disabled={saving || !settings?.tronConfigured}
            >
              {settings?.tronEnabled ? 'فعال' : 'غیرفعال'}
            </button>
          </section>

          <section
            className="admin-payment-settings__card shop-rise"
            style={{ '--rise-index': 2 } as CSSProperties}
          >
            <label className="admin-payment-settings__label" htmlFor="master-wallet">
              آدرس کیف پول اصلی (Sweep)
            </label>
            <input
              id="master-wallet"
              className="admin-payment-settings__input"
              value={masterWallet}
              onChange={(event) => setMasterWallet(event.target.value)}
              placeholder="T..."
              dir="ltr"
              autoComplete="off"
              spellCheck={false}
            />
            <p className="admin-payment-settings__note">
              واریزهای TRX پس از تأیید به این آدرس منتقل می‌شوند.
            </p>
            <button
              type="button"
              className="admin-payment-settings__save"
              onClick={() => void saveMasterWallet()}
              disabled={saving}
            >
              ذخیره آدرس
            </button>
          </section>
        </>
      )}

      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification((prev) => ({ ...prev, show: false }))}
      />
    </div>
  )
}
