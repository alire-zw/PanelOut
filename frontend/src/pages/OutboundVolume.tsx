import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { Notification } from '../components/Notification'
import { PageHeader } from '../components/PageHeader'
import { useEnsureUser } from '../hooks/useEnsureUser'
import { useTelegram } from '../hooks/useTelegram'
import {
  fetchOutboundOptions,
  fetchOutboundVolumeQuote,
  purchaseOutboundVolume,
  type OutboundOptions,
  type OutboundVolumeQuote,
} from '../lib/outboundApi'
import { formatAmountFa } from '../lib/amount'
import type { OutboundCredentialsState } from '../lib/outboundApi'
import '../styles/shop-rise.css'
import './PanelFlow.css'

function formatFaNumber(value: number) {
  return Math.trunc(Number(value) || 0).toLocaleString('fa-IR')
}

function formatVolumeLabel(gb: number) {
  if (gb >= 1024) {
    const tb = gb / 1024
    return Number.isInteger(tb)
      ? `${tb.toLocaleString('fa-IR')} ترابایت`
      : `${tb.toLocaleString('fa-IR', { maximumFractionDigits: 1 })} ترابایت`
  }
  return `${formatFaNumber(gb)} گیگابایت`
}

export function OutboundVolumePage() {
  useEnsureUser()
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [options, setOptions] = useState<OutboundOptions | null>(null)
  const [volumeGb, setVolumeGb] = useState(50)
  const [quote, setQuote] = useState<OutboundVolumeQuote | null>(null)
  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error'
  }>({ show: false, message: '', type: 'success' })

  useEffect(() => {
    void fetchOutboundOptions()
      .then((data) => {
        setOptions(data)
        setVolumeGb(data.pricing.defaultVolumeGb)
      })
      .catch(() => setOptions(null))
      .finally(() => setLoading(false))
  }, [])

  const refreshQuote = useCallback(async (gb: number) => {
    try {
      const data = await fetchOutboundVolumeQuote(gb)
      setQuote(data.quote)
    } catch {
      setQuote(null)
    }
  }, [])

  useEffect(() => {
    if (loading) return
    void refreshQuote(volumeGb)
  }, [loading, volumeGb, refreshQuote])

  const minGb = options?.pricing.defaultVolumeGb ?? 50
  const maxGb = options?.pricing.maxVolumeGb ?? 10000

  const stepDown = () => {
    haptic('light')
    setVolumeGb((prev) => {
      if (prev <= minGb) return minGb
      if (prev === 100) return minGb
      if (prev <= 500) return prev - 100
      if (prev <= 2000) return prev - 500
      return prev - 1000
    })
  }

  const stepUp = () => {
    haptic('light')
    setVolumeGb((prev) => {
      if (prev >= maxGb) return maxGb
      if (prev === minGb) return 100
      if (prev < 500) return prev + 100
      if (prev < 2000) return prev + 500
      return Math.min(prev + 1000, maxGb)
    })
  }

  const handlePurchase = async () => {
    if (!quote || !options) return
    if (options.user.balance < quote.amountIrt) {
      haptic('light')
      navigate('/wallet/charge')
      return
    }

    setBusy(true)
    try {
      const result = await purchaseOutboundVolume(volumeGb)
      haptic('light')
      navigate('/outbound/success', {
        state: {
          credentials: result.credentials,
          kind: 'volume',
        } satisfies OutboundCredentialsState,
      })
    } catch (err) {
      setNotification({
        show: true,
        message: err instanceof Error ? err.message : 'خطا در خرید',
        type: 'error',
      })
    } finally {
      setBusy(false)
    }
  }

  const insufficient = quote != null && options != null && options.user.balance < quote.amountIrt

  return (
    <div className="panel-flow">
      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification((n) => ({ ...n, show: false }))}
      />

      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title="اوتباند حجمی" onBack={() => navigate('/outbound')} />
      </div>

      <div className="panel-flow__content shop-rise" style={{ '--rise-index': 1 } as CSSProperties}>
        <div className="panel-flow__steps">
          <span className="panel-flow__step is-done" />
          <span className="panel-flow__step is-active" />
          <span className="panel-flow__step" />
        </div>

        {loading ? (
          <p className="panel-flow__loading">در حال بارگذاری…</p>
        ) : (
          <>
            <div className="panel-flow__summary">
              <h2 className="panel-flow__summary-title">انتخاب حجم</h2>
              <p className="panel-flow__summary-desc">
                حجم مورد نظر را انتخاب کنید. تخفیف ۵٪ از ۱ ترابایت و ۱۰٪ از ۵ ترابایت.
              </p>
            </div>

            <div className="panel-flow__volume-picker">
              <button type="button" className="panel-flow__volume-btn" onClick={stepDown} aria-label="کاهش">
                −
              </button>
              <div className="panel-flow__volume-value">
                <strong>{formatVolumeLabel(volumeGb)}</strong>
              </div>
              <button type="button" className="panel-flow__volume-btn" onClick={stepUp} aria-label="افزایش">
                +
              </button>
            </div>

            {quote ? (
              <div className="panel-flow__stats">
                <div className="panel-flow__stat">
                  <strong>{formatAmountFa(String(quote.baseAmountIrt))}</strong>
                  <span>مبلغ پایه</span>
                </div>
                {quote.discountPercent > 0 ? (
                  <div className="panel-flow__stat">
                    <strong>{quote.discountPercent}٪</strong>
                    <span>تخفیف</span>
                  </div>
                ) : null}
                <div className="panel-flow__stat">
                  <strong>{formatAmountFa(String(quote.amountIrt))}</strong>
                  <span>مبلغ نهایی</span>
                </div>
                <div className="panel-flow__stat">
                  <strong>{formatAmountFa(String(options?.user.balance ?? 0))}</strong>
                  <span>موجودی کیف پول</span>
                </div>
              </div>
            ) : null}

            {insufficient ? (
              <div className="panel-flow__info-box panel-flow__info-box--warn">
                <p className="panel-flow__info-box-title">موجودی ناکافی</p>
                <p className="panel-flow__info-box-desc">
                  برای خرید این حجم به {formatAmountFa(String(quote?.amountIrt ?? 0))} تومان نیاز دارید.
                </p>
              </div>
            ) : null}
          </>
        )}
      </div>

      {!loading ? (
        <footer className="panel-flow__footer shop-rise" style={{ '--rise-index': 2 } as CSSProperties}>
          <button
            type="button"
            className="panel-flow__continue"
            disabled={busy || !quote}
            onClick={() => void (insufficient ? navigate('/wallet/charge') : handlePurchase())}
          >
            {busy
              ? 'در حال پرداخت…'
              : insufficient
                ? 'افزایش موجودی'
                : `پرداخت ${formatAmountFa(String(quote?.amountIrt ?? 0))} تومان`}
          </button>
        </footer>
      ) : null}
    </div>
  )
}
