import { useEffect, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import Agreement02Icon from '../components/icons/agreement-02-stroke-rounded'
import CashierIcon from '../components/icons/cashier-stroke-rounded'
import ClipboardPasteIcon from '../components/icons/clipboard-paste-stroke-rounded'
import TestTubeIcon from '../components/icons/test-tube-stroke-rounded'
import { PageHeader } from '../components/PageHeader'
import { useEnsureUser } from '../hooks/useEnsureUser'
import { useTelegram } from '../hooks/useTelegram'
import { fetchPanelOptions, type PanelOptions } from '../lib/panelApi'
import { formatAmountFa } from '../lib/amount'
import '../styles/shop-rise.css'
import './PanelFlow.css'

function formatFaNumber(value: number) {
  return Math.trunc(Number(value) || 0).toLocaleString('fa-IR')
}

export function PanelStartPage() {
  useEnsureUser()
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const [loading, setLoading] = useState(true)
  const [options, setOptions] = useState<PanelOptions | null>(null)

  useEffect(() => {
    void fetchPanelOptions()
      .then(setOptions)
      .catch(() => setOptions(null))
      .finally(() => setLoading(false))
  }, [])

  const hasTrial = Boolean(options?.subscriptions.trial)
  const hasUsage = Boolean(options?.subscriptions.usage)
  const canClaimTrial = Boolean(options?.canClaimTrial)
  const canActivateReseller = Boolean(options?.canActivateReseller)
  const minBalanceLabel = formatAmountFa(String(options?.pricing.usageMinBalanceIrt ?? 0))

  const goTrial = () => {
    if (!canClaimTrial || hasTrial) return
    haptic('light')
    navigate('/panel/trial/username')
  }

  const goUsage = () => {
    if (hasUsage) return
    haptic('light')
    navigate('/panel/usage')
  }

  const goImport = () => {
    haptic('light')
    navigate('/panel/import')
  }

  const goReseller = () => {
    if (!canActivateReseller && !hasUsage) return
    haptic('light')
    if (!options?.user.hasEnoughBalanceForUsage) {
      navigate('/wallet/charge')
      return
    }
    navigate('/panel/reseller/username')
  }

  const trialHint = (() => {
    if (hasTrial) return 'این سرویس برای شما فعال است'
    if (canClaimTrial) {
      return `${formatFaNumber(options!.pricing.trialVolumeGb)} گیگابایت حجم آزمایشی — یک‌بار برای هر کاربر`
    }
    if (hasUsage || options?.user.hasClaimedTrial) return 'این سرویس قبلاً دریافت شده است'
    return 'در حال حاضر در دسترس نیست'
  })()

  const usageHint = hasUsage
    ? 'این سرویس برای شما فعال است'
    : options?.canUpgradeTrialToUsage
      ? `ارتقا از پنل تست — حداقل موجودی ${minBalanceLabel} تومان`
      : `پرداخت به‌ازای مصرف — حداقل موجودی ${minBalanceLabel} تومان`

  const resellerHint = !hasUsage
    ? 'پس از فعال‌سازی پنل مصرفی در دسترس است'
    : canActivateReseller
      ? 'مناسب فروش به دیگران — کیف پول جدا از حساب اصلی'
      : `حداقل موجودی ${minBalanceLabel} تومان`

  return (
    <div className="panel-flow">
      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title="دریافت پنل" onBack={() => navigate('/')} />
      </div>

      <div className="panel-flow__content shop-rise" style={{ '--rise-index': 1 } as CSSProperties}>
        <div className="panel-flow__steps">
          <span className="panel-flow__step is-active" />
          <span className="panel-flow__step" />
          <span className="panel-flow__step" />
        </div>

        <p className="panel-flow__intro">
          نوع پنل را انتخاب کنید. در مرحله بعد نام کاربری و اطلاعات ورود تکمیل می‌شود.
        </p>

        {loading ? (
          <p className="panel-flow__loading">در حال بارگذاری…</p>
        ) : (
          <div className="panel-flow__options">
            <button
              type="button"
              className="panel-flow__option"
              disabled={!canClaimTrial || hasTrial}
              onClick={goTrial}
            >
              <span className="panel-flow__option-icon">
                <TestTubeIcon width={20} height={20} color="currentColor" />
              </span>
              <span className="panel-flow__option-copy">
                <span className="panel-flow__option-title">پنل تست</span>
                <span className="panel-flow__option-hint">{trialHint}</span>
              </span>
            </button>

            <button
              type="button"
              className="panel-flow__option"
              disabled={hasUsage}
              onClick={goUsage}
            >
              <span className="panel-flow__option-icon">
                <CashierIcon width={20} height={20} color="currentColor" />
              </span>
              <span className="panel-flow__option-copy">
                <span className="panel-flow__option-title">پنل مصرفی</span>
                <span className="panel-flow__option-hint">{usageHint}</span>
              </span>
            </button>

            <button type="button" className="panel-flow__option" onClick={goImport}>
              <span className="panel-flow__option-icon">
                <ClipboardPasteIcon width={20} height={20} color="currentColor" />
              </span>
              <span className="panel-flow__option-copy">
                <span className="panel-flow__option-title">انتقال پنل موجود</span>
                <span className="panel-flow__option-hint">
                  اتصال پنل از پیش تهیه‌شده به همین حساب
                </span>
              </span>
            </button>

            <button
              type="button"
              className="panel-flow__option"
              disabled={!canActivateReseller && !hasUsage}
              onClick={goReseller}
            >
              <span className="panel-flow__option-icon">
                <Agreement02Icon width={20} height={20} color="currentColor" />
              </span>
              <span className="panel-flow__option-copy">
                <span className="panel-flow__option-title">پنل ریسلری</span>
                <span className="panel-flow__option-hint">{resellerHint}</span>
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
