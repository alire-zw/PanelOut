import { useEffect, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import DatabaseLightningIcon from '../components/icons/database-lightning-stroke-rounded'
import ChartRoseIcon from '../components/icons/chart-rose-stroke-rounded'
import { PageHeader } from '../components/PageHeader'
import { useEnsureUser } from '../hooks/useEnsureUser'
import { useTelegram } from '../hooks/useTelegram'
import { fetchOutboundOptions, type OutboundOptions } from '../lib/outboundApi'
import { formatAmountFa } from '../lib/amount'
import '../styles/shop-rise.css'
import './PanelFlow.css'

function formatFaNumber(value: number) {
  return Math.trunc(Number(value) || 0).toLocaleString('fa-IR')
}

export function OutboundStartPage() {
  useEnsureUser()
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const [loading, setLoading] = useState(true)
  const [options, setOptions] = useState<OutboundOptions | null>(null)

  useEffect(() => {
    void fetchOutboundOptions()
      .then(setOptions)
      .catch(() => setOptions(null))
      .finally(() => setLoading(false))
  }, [])

  const canVolume = Boolean(options?.canPurchaseVolume)
  const canUsage = Boolean(options?.canActivateUsage)
  const priceLabel = formatFaNumber(options?.pricing.pricePerGb ?? 0)
  const minBalanceLabel = formatAmountFa(String(options?.pricing.usageMinBalanceIrt ?? 0))

  const goVolume = () => {
    if (!canVolume) return
    haptic('light')
    navigate('/outbound/volume')
  }

  const goUsage = () => {
    if (!canUsage) {
      if (options && !options.user.hasEnoughBalanceForUsage) {
        haptic('light')
        navigate('/wallet/charge')
      }
      return
    }
    haptic('light')
    navigate('/outbound/usage')
  }

  return (
    <div className="panel-flow">
      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title="خرید اوتباند" onBack={() => navigate('/')} />
      </div>

      <div className="panel-flow__content shop-rise" style={{ '--rise-index': 1 } as CSSProperties}>
        <div className="panel-flow__steps">
          <span className="panel-flow__step is-active" />
          <span className="panel-flow__step" />
          <span className="panel-flow__step" />
        </div>

        <p className="panel-flow__intro">
          نوع اوتباند را انتخاب کنید. حجمی برای خرید مشخص، مصرفی برای پرداخت به‌ازای مصرف.
        </p>

        {loading ? (
          <p className="panel-flow__loading">در حال بارگذاری…</p>
        ) : (
          <div className="panel-flow__options">
            <button
              type="button"
              className="panel-flow__option"
              disabled={!canVolume}
              onClick={goVolume}
            >
              <span className="panel-flow__option-icon">
                <DatabaseLightningIcon width={20} height={20} color="currentColor" />
              </span>
              <span className="panel-flow__option-copy">
                <span className="panel-flow__option-title">اوتباند حجمی</span>
                <span className="panel-flow__option-hint">
                  {canVolume
                    ? `خرید حجم از کیف پول — ${priceLabel} تومان/گیگ (تخفیف حجمی)`
                    : 'در حال حاضر در دسترس نیست'}
                </span>
              </span>
            </button>

            <button
              type="button"
              className="panel-flow__option"
              disabled={!canUsage && options?.user.hasEnoughBalanceForUsage === false}
              onClick={goUsage}
            >
              <span className="panel-flow__option-icon">
                <ChartRoseIcon width={20} height={20} color="currentColor" />
              </span>
              <span className="panel-flow__option-copy">
                <span className="panel-flow__option-title">اوتباند مصرفی</span>
                <span className="panel-flow__option-hint">
                  {canUsage
                    ? `پرداخت به‌ازای مصرف — حداقل ${minBalanceLabel} تومان`
                    : `حداقل موجودی ${minBalanceLabel} تومان`}
                </span>
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
