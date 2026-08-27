import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import ArrowLeftIcon from './icons/ArrowLeftIcon'
import AiAutoRotateIcon from './icons/ai-auto-rotate-stroke-rounded'
import SocialMediaIcon from './icons/SocialMediaIcon'
import ViewIcon from './icons/ViewIcon'
import { useTelegram } from '../hooks/useTelegram'
import '../styles/shop-rise.css'
import './ShopAutoServices.css'

const autoServices = [
  {
    key: 'channel-views',
    label: 'سین خودکار',
    description: 'برای هر پست جدید کانال، بازدید به‌صورت خودکار ثبت می‌شود',
    route: '/channel-views/auto',
    icon: ViewIcon,
    gradient: 'linear-gradient(135deg, #38bdf8 0%, #0ea5e9 50%, #0284c7 100%)',
  },
  {
    key: 'reaction',
    label: 'ری‌اکشن خودکار',
    description: 'ری‌اکشن‌های دلخواه را یک‌بار تنظیم کنید، بقیه با ماست',
    route: '/reaction/auto',
    icon: SocialMediaIcon,
    gradient: 'linear-gradient(135deg, #fb7185 0%, #f43f5e 50%, #e11d48 100%)',
  },
]

type ShopAutoServicesProps = {
  riseIndex: number
}

export function ShopAutoServices({ riseIndex }: ShopAutoServicesProps) {
  const navigate = useNavigate()
  const { haptic } = useTelegram()

  return (
    <section
      className="shop-auto shop-rise"
      style={{ '--rise-index': riseIndex } as CSSProperties}
      aria-label="محصولات خودکار"
    >
      <div className="shop-auto__head">
        <h2 className="shop-auto__title">
          محصولات <span className="shop-auto__title-accent">خودکار</span>
        </h2>
        <span className="shop-auto__hint">یک‌بار تنظیم، همیشه فعال</span>
      </div>

      <div className="shop-auto__list">
        {autoServices.map((service) => {
          const Icon = service.icon

          return (
            <button
              key={service.key}
              type="button"
              className="shop-auto__row"
              style={{ '--card-gradient': service.gradient } as CSSProperties}
              onClick={() => {
                haptic('light')
                navigate(service.route)
              }}
            >
              <span className="shop-auto__icon">
                <Icon width={18} height={18} color="#ffffff" />
              </span>

              <span className="shop-auto__copy">
                <span className="shop-auto__line">
                  <span className="shop-auto__label">{service.label}</span>
                  <span className="shop-auto__badge">
                    <AiAutoRotateIcon width={11} height={11} />
                    خودکار
                  </span>
                </span>
                <span className="shop-auto__desc">{service.description}</span>
              </span>

              <ArrowLeftIcon width={16} height={16} />
            </button>
          )
        })}
      </div>
    </section>
  )
}
