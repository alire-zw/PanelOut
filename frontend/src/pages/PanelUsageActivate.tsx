import { useEffect, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { useEnsureUser } from '../hooks/useEnsureUser'
import { useTelegram } from '../hooks/useTelegram'
import { activatePanelUsage, fetchPanelOptions, type PanelOptions } from '../lib/panelApi'
import { formatAmountFa } from '../lib/amount'
import type { PanelCredentialsState, PanelUsageFlowState } from '../types/panel'
import '../styles/shop-rise.css'
import './PanelFlow.css'

function formatFaNumber(value: number) {
  return Math.trunc(Number(value) || 0).toLocaleString('fa-IR')
}

export function PanelUsageActivatePage() {
  useEnsureUser()
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [options, setOptions] = useState<PanelOptions | null>(null)

  useEffect(() => {
    void fetchPanelOptions()
      .then(setOptions)
      .catch(() => setOptions(null))
      .finally(() => setLoading(false))
  }, [])

  const upgradeFromTrial = Boolean(options?.canUpgradeTrialToUsage)
  const alreadyActive = Boolean(options?.subscriptions.usage)
  const insufficientBalance =
    !alreadyActive && !options?.user.hasEnoughBalanceForUsage && !upgradeFromTrial

  const handleConfirm = async () => {
    if (alreadyActive && options?.subscriptions.usage) {
      navigate('/panel/success', {
        state: {
          credentials: {
            username: options.subscriptions.usage.clientUsername,
            password: null,
            panelUrl: options.subscriptions.usage.panelUrl,
          },
          kind: 'usage',
        } satisfies PanelCredentialsState,
      })
      return
    }

    if (insufficientBalance) {
      haptic('light')
      navigate('/wallet/charge')
      return
    }

    if (upgradeFromTrial) {
      setBusy(true)
      setError(null)
      try {
        const result = await activatePanelUsage()
        haptic('light')
        navigate('/panel/success', {
          state: {
            credentials: result.credentials,
            kind: 'usage',
          } satisfies PanelCredentialsState,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'خطا در فعال‌سازی')
      } finally {
        setBusy(false)
      }
      return
    }

    haptic('light')
    navigate('/panel/usage/username', {
      state: { upgradeFromTrial: false } satisfies PanelUsageFlowState,
    })
  }

  return (
    <div className="panel-flow">
      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title="پنل مصرفی" onBack={() => navigate('/panel')} />
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
              <h2 className="panel-flow__summary-title">فعال‌سازی پنل به‌ازای مصرف</h2>
              <p className="panel-flow__summary-desc">
                {upgradeFromTrial
                  ? 'اکانت تست شما به پنل مصرفی ارتقا داده می‌شود و نام کاربری قبلی حفظ می‌گردد.'
                  : 'پس از فعال‌سازی، هزینه مصرف به‌صورت دوره‌ای از موجودی کیف پول شما کسر می‌شود.'}
              </p>
            </div>

            <div className="panel-flow__stats">
              <div className="panel-flow__stat">
                <strong>{formatAmountFa(String(options?.user.balance ?? 0))}</strong>
                <span>موجودی فعلی (تومان)</span>
              </div>
              <div className="panel-flow__stat">
                <strong>{formatAmountFa(String(options?.pricing.usageMinBalanceIrt ?? 0))}</strong>
                <span>حداقل موجودی لازم</span>
              </div>
              <div className="panel-flow__stat">
                <strong>{formatFaNumber(options?.pricing.usagePricePerGb ?? 0)}</strong>
                <span>قیمت هر گیگابایت (تومان)</span>
              </div>
              <div className="panel-flow__stat">
                <strong>{formatFaNumber(options?.pricing.usageMinBalanceGb ?? 0)} GB</strong>
                <span>معادل حداقل حجم</span>
              </div>
            </div>

            {alreadyActive ? (
              <div className="panel-flow__badge-wrap">
                <span className="panel-flow__badge">پنل قبلاً فعال شده است</span>
              </div>
            ) : insufficientBalance ? (
              <div className="panel-flow__badge-wrap">
                <span className="panel-flow__badge panel-flow__badge--warn">موجودی کیف پول کمتر از حداقل است</span>
              </div>
            ) : upgradeFromTrial ? (
              <div className="panel-flow__badge-wrap">
                <span className="panel-flow__badge">امکان ارتقای مستقیم از اکانت تست</span>
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
              : alreadyActive
                ? 'مشاهده اطلاعات پنل'
                : insufficientBalance
                  ? 'افزایش موجودی کیف پول'
                  : upgradeFromTrial
                    ? 'تأیید و ارتقا به مصرفی'
                    : 'ادامه — تعیین نام کاربری'}
          </button>
        </footer>
      ) : null}
    </div>
  )
}
