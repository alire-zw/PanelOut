import { useEffect, useState, type ComponentType, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { Notification, type NotificationType } from '../components/Notification'
import ArrowLeftIcon from '../components/icons/ArrowLeftIcon'
import Books02Icon from '../components/icons/books-02-stroke-rounded'
import ChatQuestion01Icon from '../components/icons/chat-question-01-stroke-rounded'
import CursorRectangleSelection01Icon from '../components/icons/cursor-rectangle-selection-01-stroke-rounded'
import LifebuoyIcon from '../components/icons/lifebuoy-stroke-rounded'
import LockIcon from '../components/icons/LockIcon'
import Robot02Icon from '../components/icons/robot-02-stroke-rounded'
import ServerStack02Icon from '../components/icons/server-stack-02-stroke-rounded'
import Wrench01Icon from '../components/icons/wrench-01-stroke-rounded'
import ZapIcon from '../components/icons/zap-stroke-rounded'
import { useEnsureUser } from '../hooks/useEnsureUser'
import { useTelegram } from '../hooks/useTelegram'
import { fetchShopActivity } from '../lib/shopActivityApi'
import '../styles/shop-rise.css'
import './HomePage.css'

/** Decorative location flags for the shop multi-location badge (display-only). */
const SHOP_MULTI_FLAGS = ['de', 'nl', 'tr', 'fi', 'gb', 'se', 'fr', 'us'] as const

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

function formatFaNumber(value: number, decimals: number) {
  return value.toLocaleString('fa-IR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function useCountUp(target: number, decimals: number, duration = 1400) {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0))

  useEffect(() => {
    if (prefersReducedMotion()) {
      setValue(target)
      return
    }

    let frame = 0
    const start = performance.now()

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      setValue(target * easeOutCubic(progress))
      if (progress < 1) {
        frame = requestAnimationFrame(tick)
      } else {
        setValue(target)
      }
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])

  return formatFaNumber(value, decimals)
}

type QuickAction = {
  id: string
  label: string
  hint: string
  tone: 'lime' | 'sky' | 'slate'
  soon?: boolean
  Icon: ComponentType<{ width?: number; height?: number; color?: string }>
}

const quickActions: QuickAction[] = [
  {
    id: 'panel',
    label: 'سرویس پنل',
    hint: 'دریافت پنل اختصاصی',
    tone: 'lime',
    Icon: CursorRectangleSelection01Icon,
  },
  {
    id: 'outbound',
    label: 'خرید اوتباند',
    hint: 'افزایش ظرفیت سرور',
    tone: 'sky',
    Icon: ServerStack02Icon,
  },
  {
    id: 'bot',
    label: 'ربات فروش اشتراک به کاربران',
    hint: 'به‌زودی',
    tone: 'slate',
    soon: true,
    Icon: Robot02Icon,
  },
]

const TB = 1024 ** 4
const GB = 1024 ** 3
const MB = 1024 ** 2

function trafficStat(bytes: number) {
  if (bytes >= TB) {
    return { target: bytes / TB, decimals: 2, unit: 'ترابایت' as const }
  }
  if (bytes >= GB) {
    return { target: bytes / GB, decimals: 2, unit: 'گیگابایت' as const }
  }
  return { target: bytes / MB, decimals: bytes >= MB ? 0 : 1, unit: 'مگابایت' as const }
}

function uptimeStat(seconds: number | null) {
  if (!seconds || seconds <= 0) {
    return { target: 0, decimals: 0, unit: 'روز' as const }
  }
  const days = seconds / 86400
  if (days >= 1) {
    return { target: Math.floor(days), decimals: 0, unit: 'روز' as const }
  }
  const hours = seconds / 3600
  if (hours >= 1) {
    return { target: Math.floor(hours), decimals: 0, unit: 'ساعت' as const }
  }
  return { target: Math.max(1, Math.floor(seconds / 60)), decimals: 0, unit: 'دقیقه' as const }
}

const perks = [
  {
    key: 'uptime',
    title: 'پایداری بالا',
    desc: 'چند سرور مجزا کنار هم',
    tone: 'accent' as const,
    Icon: Wrench01Icon,
  },
  {
    key: 'support',
    title: 'پشتیبانی سریع',
    desc: 'پاسخ‌گویی ۲۴/۷',
    tone: 'info' as const,
    Icon: LifebuoyIcon,
  },
  {
    key: 'ready',
    title: 'راه‌اندازی سریع',
    desc: 'بدون دردسر فنی شروع کن',
    tone: 'success' as const,
    Icon: ZapIcon,
  },
]

function ActivityStatItem({
  target,
  decimals,
  unit,
  label,
}: {
  target: number
  decimals: number
  unit: string | null
  label: string
}) {
  const display = useCountUp(target, decimals)

  return (
    <div className="shop-stats__item">
      <span className="shop-stats__value">
        {display}
        {unit ? <span className="shop-stats__unit">{unit}</span> : null}
      </span>
      <span className="shop-stats__label">{label}</span>
    </div>
  )
}

export function HomePage() {
  useEnsureUser()
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: NotificationType
  }>({ show: false, message: '', type: 'info' })

  const [activity, setActivity] = useState({
    trafficBytes: 0,
    totalUsers: 0,
    resellerCount: 0,
    uptimeSeconds: null as number | null,
  })

  useEffect(() => {
    let cancelled = false
    void fetchShopActivity()
      .then((data) => {
        if (cancelled) return
        setActivity({
          trafficBytes: data.trafficBytes,
          totalUsers: data.totalUsers,
          resellerCount: data.resellerCount,
          uptimeSeconds: data.uptimeSeconds,
        })
      })
      .catch(() => {
        /* keep zeros if panels are unreachable */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const showNotification = (message: string, type: NotificationType = 'info') => {
    haptic('light')
    setNotification({ show: true, message, type })
  }

  const traffic = trafficStat(activity.trafficBytes)
  const uptime = uptimeStat(activity.uptimeSeconds)
  const activityStats = [
    {
      key: 'traffic',
      target: traffic.target,
      decimals: traffic.decimals,
      unit: traffic.unit,
      label: 'ترافیک مصرفی',
    },
    {
      key: 'users',
      target: activity.totalUsers,
      decimals: 0,
      unit: null as string | null,
      label: 'کاربر',
    },
    {
      key: 'resellers',
      target: activity.resellerCount,
      decimals: 0,
      unit: null as string | null,
      label: 'نماینده فروش',
    },
    {
      key: 'uptime',
      target: uptime.target,
      decimals: uptime.decimals,
      unit: uptime.unit,
      label: 'آپ‌تایم',
    },
  ]

  return (
    <div className="shop">
      <section className="shop-hero shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <div className="shop-hero__copy">
          <p className="shop-hero__eyebrow">پنل اختصاصی نمایندگی</p>
          <h1 className="shop-hero__title">سرویس پنل خودت رو دریافت کن</h1>
          <p className="shop-hero__sub">
            با پنل اختصاصی، فروش و مدیریت کاربران رو حرفه‌ای‌تر پیش ببر؛ زیرساخت پایدار و پشتیبانی همراهته.
          </p>
        </div>
        <button
          type="button"
          className="shop-hero__cta"
          onClick={() => {
            haptic('light')
            navigate('/panel')
          }}
        >
          شروع مراحل دریافت پنل
        </button>
      </section>

      <div
        className="shop-multi shop-rise"
        style={{ '--rise-index': 1 } as CSSProperties}
        aria-label="مولتی لوکیشن"
      >
        <div className="shop-multi__copy">
          <span className="shop-multi__label">مولتی لوکیشن</span>
          <span className="shop-multi__hint">زیرساخت پایدار با سرورهای مستقل و متعدد</span>
        </div>
        <div className="shop-multi__flags" aria-hidden="true">
          {SHOP_MULTI_FLAGS.map((code) => (
            <span key={code} className="shop-multi__flag">
              <img src={`/flags/${code}.svg`} alt="" width={32} height={32} draggable={false} />
            </span>
          ))}
        </div>
      </div>

      <div className="shop-actions shop-rise" style={{ '--rise-index': 2 } as CSSProperties}>
        {quickActions.map((action) => {
          const Icon = action.Icon
          return (
            <button
              key={action.id}
              type="button"
              className={`shop-actions__tile shop-actions__tile--${action.tone}${
                action.id === 'bot' ? ' shop-actions__tile--wide' : ''
              }`}
              onClick={() => {
                if (action.soon) {
                  showNotification('ربات فروش نمایندگی به‌زودی اضافه می‌شود', 'warning')
                  return
                }
                if (action.id === 'panel') {
                  haptic('light')
                  navigate('/panel')
                  return
                }
                showNotification(`${action.label} — به‌زودی`)
              }}
            >
              <span className="shop-actions__icon">
                <Icon width={20} height={20} color="currentColor" />
              </span>
              <span className="shop-actions__text">
                <span className="shop-actions__label">{action.label}</span>
                <span className="shop-actions__hint">
                  {action.soon ? (
                    <>
                      <LockIcon width={12} height={12} color="currentColor" /> به‌زودی
                    </>
                  ) : (
                    action.hint
                  )}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <section
        className="shop-stats shop-rise"
        style={{ '--rise-index': 3 } as CSSProperties}
        aria-label="گزارش فعالیت پنلوت"
      >
        <div className="shop-stats__head">
          <h2 className="shop-stats__title">
            گزارش فعالیت <span className="shop-stats__title-accent">پنلوت</span>
          </h2>
        </div>
        <div className="shop-stats__row">
          {activityStats.map((stat) => (
            <ActivityStatItem
              key={stat.key}
              target={stat.target}
              decimals={stat.decimals}
              unit={stat.unit}
              label={stat.label}
            />
          ))}
        </div>
      </section>

      <section
        className="shop-perks shop-rise"
        style={{ '--rise-index': 4 } as CSSProperties}
        aria-label="چرا پنلوت؟"
      >
        <div className="shop-perks__head">
          <h2 className="shop-perks__title">
            چرا <span className="shop-perks__title-accent">پنلوت</span>؟
          </h2>
        </div>
        <div className="shop-perks__grid">
          {perks.map((perk) => {
            const Icon = perk.Icon
            return (
              <div key={perk.key} className={`shop-perks__item shop-perks__item--${perk.tone}`}>
                <span className="shop-perks__icon">
                  <Icon width={16} height={16} color="currentColor" />
                </span>
                <span className="shop-perks__name">{perk.title}</span>
                <span className="shop-perks__desc">{perk.desc}</span>
              </div>
            )
          })}
        </div>

        <div className="shop-perks__links">
          <button
            type="button"
            className="shop-perks__support"
            onClick={() => {
              haptic('light')
              navigate('/faq')
            }}
          >
            <span className="shop-perks__support-icon shop-perks__support-icon--faq">
              <Books02Icon width={18} height={18} />
            </span>
            <span className="shop-perks__support-copy">
              <span className="shop-perks__support-title">سوالات متداول</span>
              <span className="shop-perks__support-desc">پاسخ سوال‌های پرتکرار نمایندگی</span>
            </span>
            <ArrowLeftIcon width={16} height={16} />
          </button>

          <button
            type="button"
            className="shop-perks__support"
            onClick={() => {
              haptic('light')
              navigate('/support')
            }}
          >
            <span className="shop-perks__support-icon">
              <ChatQuestion01Icon width={18} height={18} />
            </span>
            <span className="shop-perks__support-copy">
              <span className="shop-perks__support-title">سوالی داری؟</span>
              <span className="shop-perks__support-desc">از پشتیبانی بپرس؛ کمکت می‌کنیم</span>
            </span>
            <ArrowLeftIcon width={16} height={16} />
          </button>
        </div>
      </section>

      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification((prev) => ({ ...prev, show: false }))}
      />
    </div>
  )
}
