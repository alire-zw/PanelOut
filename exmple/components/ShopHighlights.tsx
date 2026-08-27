import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import ArrowLeftIcon from './icons/ArrowLeftIcon'
import ClockIcon from './icons/ClockIcon'
import IdVerifiedIcon from './icons/id-verified-stroke-rounded'
import LockIcon from './icons/LockIcon'
import SuccessIcon from './icons/SuccessIcon'
import Ticket02Icon from './icons/ticket-02-stroke-rounded'
import { useTelegram } from '../hooks/useTelegram'
import '../styles/shop-rise.css'
import './ShopHighlights.css'

const features = [
  { key: 'instant', title: 'تحویل آنی', desc: 'بلافاصله پس از پرداخت', tone: 'info' as const },
  { key: 'secure', title: 'پرداخت امن', desc: 'درگاه رسمی و مطمئن', tone: 'accent' as const },
  { key: 'guarantee', title: 'ضمانت سفارش', desc: 'بازگشت وجه در صورت خطا', tone: 'success' as const },
]

type ShopHighlightsProps = {
  riseIndex: number
}

export function ShopHighlights({ riseIndex }: ShopHighlightsProps) {
  const navigate = useNavigate()
  const { haptic } = useTelegram()

  return (
    <section
      className="shop-highlights shop-rise"
      style={{ '--rise-index': riseIndex } as CSSProperties}
      aria-label="مزیت‌های خرید"
    >
      <div className="shop-highlights__grid">
        {features.map((feature) => (
          <div
            key={feature.key}
            className={`shop-highlights__item shop-highlights__item--${feature.tone}`}
          >
            <span className="shop-highlights__icon">
              {feature.key === 'instant' && <ClockIcon width={16} height={16} />}
              {feature.key === 'secure' && <LockIcon width={16} height={16} />}
              {feature.key === 'guarantee' && <SuccessIcon width={16} height={16} />}
            </span>
            <span className="shop-highlights__name">{feature.title}</span>
            <span className="shop-highlights__desc">{feature.desc}</span>
          </div>
        ))}
      </div>

      <div className="shop-highlights__seals">
        {/* Exact Enamad markup — no rel="noopener noreferrer" */}
        <div className="shop-highlights__seal shop-highlights__seal--enamad">
          <div
            className="shop-highlights__enamad"
            dangerouslySetInnerHTML={{
              __html:
                "<a referrerpolicy='origin' target='_blank' href='https://trustseal.enamad.ir/?id=769509&Code=cAHnaMAfcQvwkgtfSi39ehxcq1x51T4L'><img referrerpolicy='origin' src='https://trustseal.enamad.ir/logo.aspx?id=769509&Code=cAHnaMAfcQvwkgtfSi39ehxcq1x51T4L' alt='' style='cursor:pointer' code='cAHnaMAfcQvwkgtfSi39ehxcq1x51T4L'></a>",
            }}
          />
          <span className="shop-highlights__seal-label">نماد اعتماد الکترونیکی</span>
        </div>

        <div className="shop-highlights__seal shop-highlights__seal--empty">
          <span className="shop-highlights__seal-placeholder">
            <IdVerifiedIcon width={20} height={20} />
          </span>
          <span className="shop-highlights__seal-label">نماد درگاه پرداخت</span>
        </div>
      </div>

      <button
        type="button"
        className="shop-highlights__support"
        onClick={() => {
          haptic('light')
          navigate('/support')
        }}
      >
        <span className="shop-highlights__support-icon">
          <Ticket02Icon width={18} height={18} />
        </span>
        <span className="shop-highlights__support-copy">
          <span className="shop-highlights__support-title">سوالی دارید؟</span>
          <span className="shop-highlights__support-desc">
            پشتیبانی وایرال‌تل هر روز هفته پاسخگوی شماست
          </span>
        </span>
        <ArrowLeftIcon width={16} height={16} />
      </button>
    </section>
  )
}
