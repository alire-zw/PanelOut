import './TelegramMemberServiceStats.css'

type TelegramMemberServiceStatsProps = {
  rate: number
  min: number
  max: number
  compact?: boolean
}

export function TelegramMemberServiceStats({
  rate,
  min,
  max,
  compact = false,
}: TelegramMemberServiceStatsProps) {
  return (
    <span
      className={`tm-service-stats${compact ? ' tm-service-stats--compact' : ''}`}
    >
      <span className="tm-service-stats__stat tm-service-stats__stat--price">
        <span className="tm-service-stats__label">قیمت</span>
        <span className="tm-service-stats__value">
          {rate.toLocaleString('fa-IR')}
          <span className="tm-service-stats__unit">تومان به ازای ۱۰۰۰ عدد</span>
        </span>
      </span>
      <span className="tm-service-stats__stat">
        <span className="tm-service-stats__label">حداقل</span>
        <span className="tm-service-stats__value">{min.toLocaleString('fa-IR')}</span>
      </span>
      <span className="tm-service-stats__stat">
        <span className="tm-service-stats__label">حداکثر</span>
        <span className="tm-service-stats__value">{max.toLocaleString('fa-IR')}</span>
      </span>
    </span>
  )
}
