import { useEffect, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import FolderSyncIcon from '../components/icons/folder-sync-stroke-rounded'
import FolderSymlinkIcon from '../components/icons/folder-symlink-stroke-rounded'
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
  const [actionChoice, setActionChoice] = useState<'upgrade' | 'new'>('upgrade')

  useEffect(() => {
    void fetchPanelOptions()
      .then(setOptions)
      .catch(() => setOptions(null))
      .finally(() => setLoading(false))
  }, [])

  const hasTrial = Boolean(options?.subscriptions.trial)
  const alreadyActive = Boolean(options?.subscriptions.usage)
  const insufficientBalance =
    !alreadyActive && !options?.user.hasEnoughBalanceForUsage

  const handleConfirm = async () => {
    if (alreadyActive && options?.subscriptions.usage) {
      const pwd =
        options.subscriptions.usage.adminPassword ||
        options.user.panelAdminPassword ||
        null
      navigate('/panel/success', {
        state: {
          credentials: {
            username: options.subscriptions.usage.clientUsername,
            password: pwd,
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

    // If user chose to upgrade the existing trial panel
    if (hasTrial && actionChoice === 'upgrade') {
      setBusy(true)
      setError(null)
      try {
        const result = await activatePanelUsage({ mode: 'upgrade' })
        haptic('light')
        navigate('/panel/success', {
          state: {
            credentials: result.credentials,
            kind: 'usage',
          } satisfies PanelCredentialsState,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'خطا در ارتقای پنل')
      } finally {
        setBusy(false)
      }
      return
    }

    // If user chose to create a new user (or doesn't have a trial)
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
              <h2 className="panel-flow__summary-title">فعال‌سازی پنل مصرفی</h2>
              <p className="panel-flow__summary-desc">
                پس از فعال‌سازی، هزینه مصرف به‌صورت دوره‌ای از موجودی کیف پول شما کسر می‌شود.
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

            {hasTrial && !alreadyActive ? (
              <div className="panel-flow__options" style={{ marginTop: 4 }}>
                <button
                  type="button"
                  className={`panel-flow__option${actionChoice === 'upgrade' ? ' panel-flow__option--selected' : ''}`}
                  onClick={() => {
                    haptic('light')
                    setActionChoice('upgrade')
                  }}
                >
                  <span className="panel-flow__option-icon">
                    <FolderSyncIcon width={20} height={20} color="currentColor" />
                  </span>
                  <span className="panel-flow__option-copy">
                    <span className="panel-flow__option-title">تبدیل پنل تست فعلی به مصرفی</span>
                    <span className="panel-flow__option-hint">
                      نام کاربری ({options?.subscriptions.trial?.clientUsername}) و تنظیمات فعلی حفظ می‌شود.
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  className={`panel-flow__option${actionChoice === 'new' ? ' panel-flow__option--selected' : ''}`}
                  onClick={() => {
                    haptic('light')
                    setActionChoice('new')
                  }}
                >
                  <span className="panel-flow__option-icon">
                    <FolderSymlinkIcon width={20} height={20} color="currentColor" />
                  </span>
                  <span className="panel-flow__option-copy">
                    <span className="panel-flow__option-title">ساخت نام کاربری جدید</span>
                    <span className="panel-flow__option-hint">
                      اکانت تست قبلی غیرفعال شده و یوزر جدید ساخته می‌شود.
                    </span>
                  </span>
                </button>
              </div>
            ) : null}

            {alreadyActive ? (
              <div className="panel-flow__info-box">
                <p className="panel-flow__info-box-title">پنل قبلاً فعال شده است</p>
                <p className="panel-flow__info-box-desc">
                  پنل مصرفی شخصی شما فعال است. می‌توانید اطلاعات ورود را مشاهده کنید یا از بخش دریافت پنل،
                  یک پنل ریسلری جدا با کیف پول اختصاصی بسازید.
                </p>
              </div>
            ) : insufficientBalance ? (
              <div className="panel-flow__info-box panel-flow__info-box--warn">
                <p className="panel-flow__info-box-title">موجودی ناکافی</p>
                <p className="panel-flow__info-box-desc">
                  برای فعال‌سازی، موجودی کیف پول باید حداقل معادل{' '}
                  {formatAmountFa(String(options?.pricing.usageMinBalanceIrt ?? 0))} تومان باشد.
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
              : alreadyActive
                ? 'مشاهده اطلاعات پنل'
                : insufficientBalance
                  ? 'افزایش موجودی کیف پول'
                  : hasTrial && actionChoice === 'upgrade'
                    ? 'تبدیل و ارتقای پنل تست'
                    : hasTrial && actionChoice === 'new'
                      ? 'غیرفعال‌سازی تست و ساخت جدید'
                      : 'ادامه — تعیین نام کاربری'}
          </button>
        </footer>
      ) : null}
    </div>
  )
}
