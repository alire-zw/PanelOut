import { useEffect, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { useEnsureUser } from '../hooks/useEnsureUser'
import { useTelegram } from '../hooks/useTelegram'
import { activateOutboundUsage, fetchOutboundOptions, type OutboundOptions } from '../lib/outboundApi'
import { formatAmountFa } from '../lib/amount'
import type { OutboundCredentialsState } from '../lib/outboundApi'
import '../styles/shop-rise.css'
import './PanelFlow.css'

function formatFaNumber(value: number) {
  return Math.trunc(Number(value) || 0).toLocaleString('fa-IR')
}

export function OutboundUsageActivatePage() {
  useEnsureUser()
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [options, setOptions] = useState<OutboundOptions | null>(null)

  useEffect(() => {
    void fetchOutboundOptions()
      .then(setOptions)
      .catch(() => setOptions(null))
      .finally(() => setLoading(false))
  }, [])

  const insufficient = options != null && !options.user.hasEnoughBalanceForUsage

  const handleConfirm = async () => {
    if (insufficient) {
      haptic('light')
      navigate('/wallet/charge')
      return
    }

    setBusy(true)
    setError(null)
    try {
      const result = await activateOutboundUsage()
      haptic('light')
      navigate('/outbound/success', {
        state: {
          credentials: result.credentials,
          kind: 'usage',
        } satisfies OutboundCredentialsState,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در فعال‌سازی')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="panel-flow">
      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title="اوتباند مصرفی" onBack={() => navigate('/outbound')} />
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
              <h2 className="panel-flow__summary-title">فعال‌سازی اوتباند مصرفی</h2>
              <p className="panel-flow__summary-desc">
                پس از فعال‌سازی، هزینه مصرف به‌صورت دوره‌ای از موجودی کیف پول شما کسر می‌شود.
              </p>
            </div>

            <div className="panel-flow__stats">
              <div className="panel-flow__stat">
                <strong>{formatAmountFa(String(options?.user.balance ?? 0))}</strong>
                <span>موجودی فعلی</span>
              </div>
              <div className="panel-flow__stat">
                <strong>{formatAmountFa(String(options?.pricing.usageMinBalanceIrt ?? 0))}</strong>
                <span>حداقل موجودی</span>
              </div>
              <div className="panel-flow__stat">
                <strong>{formatFaNumber(options?.pricing.pricePerGb ?? 0)}</strong>
                <span>قیمت هر گیگ (تومان)</span>
              </div>
              <div className="panel-flow__stat">
                <strong>{formatFaNumber(options?.pricing.usageMinBalanceGb ?? 0)} GB</strong>
                <span>معادل حداقل</span>
              </div>
            </div>

            {insufficient ? (
              <div className="panel-flow__info-box panel-flow__info-box--warn">
                <p className="panel-flow__info-box-title">موجودی ناکافی</p>
                <p className="panel-flow__info-box-desc">
                  برای فعال‌سازی به حداقل {formatAmountFa(String(options?.pricing.usageMinBalanceIrt ?? 0))}{' '}
                  تومان نیاز دارید.
                </p>
              </div>
            ) : null}

            {error ? <p className="panel-flow__error">{error}</p> : null}
          </>
        )}
      </div>

      {!loading ? (
        <footer className="panel-flow__footer shop-rise" style={{ '--rise-index': 2 } as CSSProperties}>
          <button
            type="button"
            className="panel-flow__continue"
            disabled={busy}
            onClick={() => void handleConfirm()}
          >
            {busy
              ? 'در حال فعال‌سازی…'
              : insufficient
                ? 'افزایش موجودی'
                : 'تأیید و فعال‌سازی'}
          </button>
        </footer>
      ) : null}
    </div>
  )
}
