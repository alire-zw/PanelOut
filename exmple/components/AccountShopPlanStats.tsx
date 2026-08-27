import { formatTomanPrice } from '../lib/formatStars'
import './AccountShopPlanStats.css'

type AccountShopPlanStatsProps = {
  toman: number
  durationLabel?: string | null
  warrantyLabel?: string | null
  compact?: boolean
  unavailable?: boolean
}

export function AccountShopPlanStats({
  toman,
  durationLabel,
  warrantyLabel,
  compact = false,
  unavailable = false,
}: AccountShopPlanStatsProps) {
  return (
    <span className={`as-plan-stats${compact ? ' as-plan-stats--compact' : ''}`}>
      <span className="as-plan-stats__stat as-plan-stats__stat--price">
        <span className="as-plan-stats__label">قیمت</span>
        <span className="as-plan-stats__value">
          {unavailable ? (
            'ناموجود'
          ) : toman > 0 ? (
            <>
              {formatTomanPrice(toman)}
              <span className="as-plan-stats__unit">تومان</span>
            </>
          ) : (
            '—'
          )}
        </span>
      </span>
      <span className="as-plan-stats__stat">
        <span className="as-plan-stats__label">مدت</span>
        <span className="as-plan-stats__value">{durationLabel?.trim() || '—'}</span>
      </span>
      <span className="as-plan-stats__stat">
        <span className="as-plan-stats__label">گارانتی</span>
        <span className="as-plan-stats__value">{warrantyLabel?.trim() || '—'}</span>
      </span>
    </span>
  )
}
