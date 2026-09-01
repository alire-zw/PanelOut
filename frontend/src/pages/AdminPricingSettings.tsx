import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { Notification } from '../components/Notification'
import { PageHeader } from '../components/PageHeader'
import { useAdminAccess } from '../hooks/useAdminAccess'
import { useTelegram } from '../hooks/useTelegram'
import {
  fetchAdminPricingSettings,
  updateAdminPricingSettings,
  type SubscriptionPricing,
} from '../lib/paymentsApi'
import { isTelegramWebApp } from '../lib/telegram'
import '../styles/shop-rise.css'
import './AdminPricingSettings.css'

function formatFaNumber(value: number) {
  return Math.trunc(Number(value) || 0).toLocaleString('fa-IR')
}

function digitsOnly(value: string) {
  return value.replace(/[^\d]/g, '')
}

export function AdminPricingSettingsPage() {
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const { ready, allowed } = useAdminAccess()

  const [pricing, setPricing] = useState<SubscriptionPricing | null>(null)
  const [panelUsagePrice, setPanelUsagePrice] = useState('4000')
  const [outboundPrice, setOutboundPrice] = useState('4000')
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
    void fetchAdminPricingSettings()
      .then((data) => {
        if (cancelled) return
        setPricing(data)
        setPanelUsagePrice(String(data.panelUsagePricePerGb || 4000))
        setOutboundPrice(String(data.outboundPricePerGb || 4000))
      })
      .catch((err) => {
        if (!cancelled) {
          setNotification({
            show: true,
            message: err instanceof Error ? err.message : 'خطا در دریافت قیمت‌گذاری',
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

  const handleSave = async () => {
    if (saving) return
    haptic('light')
    const usage = Number(digitsOnly(panelUsagePrice))
    const outbound = Number(digitsOnly(outboundPrice))

    if (!usage || usage <= 0 || !outbound || outbound <= 0) {
      setNotification({
        show: true,
        message: 'قیمت هر گیگابایت نامعتبر است',
        type: 'error',
      })
      return
    }

    setSaving(true)
    try {
      const next = await updateAdminPricingSettings({
        panelUsagePricePerGb: usage,
        outboundPricePerGb: outbound,
        panelUnlimitedPricePerSub: pricing?.panelUnlimitedPricePerSub || 4000,
        panelUnlimitedPricePerUser: pricing?.panelUnlimitedPricePerUser || 5000,
      })
      setPricing(next)
      setPanelUsagePrice(String(next.panelUsagePricePerGb))
      setOutboundPrice(String(next.outboundPricePerGb))
      setNotification({ show: true, message: 'نرخ‌ها ذخیره شد', type: 'success' })
    } catch (err) {
      setNotification({
        show: true,
        message: err instanceof Error ? err.message : 'خطا در ذخیره قیمت‌ها',
        type: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  const numUsage = Number(digitsOnly(panelUsagePrice)) || 0
  const minBalance = numUsage * 50

  return (
    <div className="admin-pricing">
      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title="قیمت‌گذاری" onBack={handleBack} />
      </div>

      <div className="admin-pricing__content">
        <h2
          className="admin-pricing__section-title shop-rise"
          style={{ '--rise-index': 1 } as CSSProperties}
        >
          نرخ مصرف
        </h2>

        {loading ? (
          <div
            className="admin-pricing__card admin-pricing__card--skeleton shop-rise"
            style={{ '--rise-index': 2 } as CSSProperties}
            aria-hidden="true"
          >
            <div className="admin-pricing__row">
              <div className="admin-pricing__copy">
                <span className="admin-pricing__skel admin-pricing__skel--title" />
                <span className="admin-pricing__skel admin-pricing__skel--hint" />
              </div>
              <span className="admin-pricing__skel admin-pricing__skel--badge" />
            </div>
            <div className="admin-pricing__field">
              <span className="admin-pricing__skel admin-pricing__skel--label" />
              <span className="admin-pricing__skel admin-pricing__skel--input" />
            </div>
            <span className="admin-pricing__skel admin-pricing__skel--meta" />
            <span className="admin-pricing__skel admin-pricing__skel--btn" />
          </div>
        ) : (
          <div
            className="admin-pricing__card shop-rise"
            style={{ '--rise-index': 2 } as CSSProperties}
          >
            <div className="admin-pricing__row">
              <div className="admin-pricing__copy">
                <span className="admin-pricing__label">قیمت پنل مصرفی</span>
                <span className="admin-pricing__hint">
                  مبنای محاسبه مصرف پنل شخصی و ریسلری
                </span>
              </div>
              <span className="admin-pricing__badge">
                {formatFaNumber(numUsage)}
                <span className="admin-pricing__badge-unit">تومان</span>
              </span>
            </div>

            <div className="admin-pricing__field">
              <label className="admin-pricing__field-label" htmlFor="panel-usage-price">
                نرخ پایه (تومان)
              </label>
              <input
                id="panel-usage-price"
                type="text"
                inputMode="numeric"
                className="admin-pricing__input"
                value={panelUsagePrice}
                onChange={(e) => setPanelUsagePrice(digitsOnly(e.target.value))}
                placeholder="4000"
                dir="ltr"
                autoComplete="off"
              />
            </div>

            <div className="admin-pricing__field">
              <label className="admin-pricing__field-label" htmlFor="outbound-price">
                نرخ اوتباند (تومان)
              </label>
              <input
                id="outbound-price"
                type="text"
                inputMode="numeric"
                className="admin-pricing__input"
                value={outboundPrice}
                onChange={(e) => setOutboundPrice(digitsOnly(e.target.value))}
                placeholder="4000"
                dir="ltr"
                autoComplete="off"
              />
            </div>

            <div className="admin-pricing__meta">
              <span className="admin-pricing__meta-label">حداقل موجودی فعال‌سازی (۵۰ گیگ)</span>
              <span className="admin-pricing__meta-value">
                {formatFaNumber(minBalance)} تومان
              </span>
            </div>

            <button
              type="button"
              className="admin-pricing__save"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? 'در حال ذخیره…' : 'ذخیره نرخ‌ها'}
            </button>
          </div>
        )}

        {pricing?.dateUpdated && !loading ? (
          <p
            className="admin-pricing__updated shop-rise"
            style={{ '--rise-index': 3 } as CSSProperties}
          >
            آخرین به‌روزرسانی: {new Date(pricing.dateUpdated).toLocaleString('fa-IR')}
          </p>
        ) : null}
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
