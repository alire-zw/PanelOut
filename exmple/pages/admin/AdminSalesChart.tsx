import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { balanceToToman } from '../../lib/api'
import { formatFaChartDay, formatFaDateLong, formatFaNumber } from './adminLabels'

export type SalesChartPoint = {
  day: string
  amountToman: string
  count: number
}

function formatCompactAmount(amount: number): string {
  if (amount >= 1_000_000_000) {
    const value = amount / 1_000_000_000
    const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10
    return `${formatFaNumber(rounded)} میلیارد`
  }
  if (amount >= 1_000_000) {
    const value = amount / 1_000_000
    const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10
    return `${formatFaNumber(rounded)} میلیون`
  }
  if (amount >= 1000) {
    return formatFaNumber(Math.round(amount / 1000) * 1000)
  }
  return formatFaNumber(amount)
}

type AdminSalesChartProps = {
  points: SalesChartPoint[]
  compact?: boolean
  onSelect?: (point: SalesChartPoint) => void
  tipSuffix?: string
}

export function AdminSalesChart({
  points,
  compact = false,
  onSelect,
  tipSuffix = 'تومان',
}: AdminSalesChartProps) {
  const values = useMemo(
    () => points.map((point) => balanceToToman(point.amountToman)),
    [points],
  )
  const max = Math.max(...values, 1)
  const peakIndex = useMemo(() => {
    let best = 0
    for (let i = 1; i < values.length; i += 1) {
      if (values[i] > values[best]) best = i
    }
    return best
  }, [values])

  const [activeIndex, setActiveIndex] = useState(peakIndex)

  useEffect(() => {
    setActiveIndex(peakIndex)
  }, [peakIndex, points])

  const active = points[activeIndex] ?? points[peakIndex]
  const activeAmount = active ? balanceToToman(active.amountToman) : 0
  const step = points.length > 14 ? 5 : 1
  const showBarCaps = !compact && points.length <= 10

  const select = (index: number) => {
    setActiveIndex(index)
    const point = points[index]
    if (point) onSelect?.(point)
  }

  if (points.length === 0) return null

  return (
    <div className={`admin-chart${compact ? ' admin-chart--compact' : ''}`}>
      {!compact && active && (
        <div className="admin-chart__tip" role="status">
          <div className="admin-chart__tip-main">
            <span className="admin-chart__tip-date">{formatFaDateLong(active.day)}</span>
            <strong className="admin-chart__tip-amount">
              {formatFaNumber(activeAmount)} {tipSuffix}
            </strong>
          </div>
          <div className="admin-chart__tip-meta">
            <span>{formatFaNumber(active.count)} سفارش</span>
            {activeIndex === peakIndex && activeAmount > 0 && (
              <span className="admin-chart__tip-peak">اوج فروش</span>
            )}
          </div>
        </div>
      )}

      <div className="admin-chart__body">
        {!compact && (
          <div className="admin-chart__y" aria-hidden="true">
            <span>{formatCompactAmount(max)}</span>
            <span>{formatCompactAmount(Math.round(max / 2))}</span>
            <span>۰</span>
          </div>
        )}

        <div className="admin-chart__plot" aria-label="نمودار فروش">
          {!compact && (
            <div className="admin-chart__grid" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          )}

          <div className="admin-chart__bars">
            {points.map((point, index) => {
              const amount = values[index] ?? 0
              const height = Math.max(amount > 0 ? 12 : 6, Math.round((amount / max) * 100))
              const showLabel =
                !compact && (index % step === 0 || index === points.length - 1 || index === activeIndex)
              const isActive = index === activeIndex
              const isPeak = index === peakIndex && amount > 0

              return (
                <button
                  key={point.day}
                  type="button"
                  className={`admin-chart__col${isActive ? ' is-active' : ''}${isPeak ? ' is-peak' : ''}`}
                  onClick={() => select(index)}
                  aria-pressed={isActive}
                  aria-label={`${formatFaDateLong(point.day)}، ${formatFaNumber(amount)} تومان، ${formatFaNumber(point.count)} سفارش`}
                >
                  <div className="admin-chart__bar-wrap">
                    {showBarCaps && amount > 0 && (isActive || isPeak) && (
                      <span className="admin-chart__cap">{formatCompactAmount(amount)}</span>
                    )}
                    <div
                      className="admin-chart__bar"
                      style={
                        {
                          '--bar-h': `${height}%`,
                          '--bar-delay': `${index * 24}ms`,
                        } as CSSProperties
                      }
                    />
                  </div>
                  {showLabel && (
                    <span className="admin-chart__label">{formatFaChartDay(point.day)}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {!compact && (
        <p className="admin-chart__hint">برای دیدن مبلغ و تعداد سفارش، روی هر ستون بزنید</p>
      )}
    </div>
  )
}
