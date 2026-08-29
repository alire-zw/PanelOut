import { useEffect, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import CashierIcon from '../components/icons/cashier-stroke-rounded'
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

  const goTrial = () => {
    if (!options?.canClaimTrial) return
    haptic('light')
    navigate('/panel/trial/username')
  }

  const goUsage = () => {
    haptic('light')
    navigate('/panel/usage')
  }

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
          نوع سرویس پنل را انتخاب کنید. مراحل بعدی شامل تأیید، نام کاربری و دریافت اطلاعات ورود است.
        </p>

        {loading ? (
          <p className="panel-flow__loading">در حال بارگذاری…</p>
        ) : (
          <div className="panel-flow__options">
            <button
              type="button"
              className="panel-flow__option"
              disabled={!options?.canClaimTrial}
              onClick={goTrial}
            >
              <span className="panel-flow__option-icon">
                <TestTubeIcon width={20} height={20} color="currentColor" />
              </span>
              <span className="panel-flow__option-copy">
                <span className="panel-flow__option-title">ساخت اکانت و تست</span>
                <span className="panel-flow__option-hint">
                  {options?.canClaimTrial
                    ? `${formatFaNumber(options.pricing.trialVolumeGb)} گیگابایت رایگان — یک‌بار برای هر کاربر`
                    : options?.subscriptions.trial
                      ? 'قبلاً دریافت شده'
                      : 'در حال حاضر در دسترس نیست'}
                </span>
              </span>
            </button>

            <button type="button" className="panel-flow__option" onClick={goUsage}>
              <span className="panel-flow__option-icon">
                <CashierIcon width={20} height={20} color="currentColor" />
              </span>
              <span className="panel-flow__option-copy">
                <span className="panel-flow__option-title">پنل به‌ازای مصرف</span>
                <span className="panel-flow__option-hint">
                  {options?.subscriptions.usage
                    ? 'قبلاً فعال شده — مشاهده جزئیات'
                    : options?.canUpgradeTrialToUsage
                      ? 'ارتقا از اکانت تست با موجودی کافی'
                      : `حداقل موجودی ${formatAmountFa(String(options?.pricing.usageMinBalanceIrt ?? 0))} تومان`}
                </span>
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
