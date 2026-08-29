import { useEffect, useState, type ComponentType, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import BankCardIcon from '../components/icons/BankCardIcon'
import LockIcon from '../components/icons/LockIcon'
import ServerStack02Icon from '../components/icons/server-stack-02-stroke-rounded'
import DepositCryptoIcon from '../components/icons/DepositCryptoIcon'
import PaymentHistoryIcon from '../components/icons/PaymentHistoryIcon'
import RegularUserIcon from '../components/icons/RegularUserIcon'
import Ticket02Icon from '../components/icons/ticket-02-stroke-rounded'
import { useAdminAccess } from '../hooks/useAdminAccess'
import { useTelegram } from '../hooks/useTelegram'
import { fetchAdminOverview, type AdminOverview } from '../lib/paymentsApi'
import '../styles/shop-rise.css'
import './Admin.css'

type HubAction = {
  id: string
  label: string
  hint: string
  path: string
  tone: 'teal' | 'sky' | 'amber' | 'rose' | 'slate' | 'lime'
  Icon: ComponentType<{ width?: number; height?: number; color?: string }>
  meta?: string
}

function formatFaNumber(value: number) {
  return Math.trunc(Number(value) || 0).toLocaleString('fa-IR')
}

let cachedAdminOverview: AdminOverview | null = null

export function AdminPage() {
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const { ready, allowed } = useAdminAccess()
  const [overview, setOverview] = useState<AdminOverview | null>(() => cachedAdminOverview)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(() => !cachedAdminOverview)

  useEffect(() => {
    if (!ready || !allowed) return
    let cancelled = false
    if (!cachedAdminOverview) setLoading(true)
    setError(null)
    void fetchAdminOverview()
      .then((data) => {
        if (cancelled) return
        cachedAdminOverview = data
        setOverview(data)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'خطا در دریافت داشبورد')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [allowed, ready])

  if (!ready || !allowed) return null

  const open = (path: string) => {
    haptic('light')
    navigate(path)
  }

  const primaryActions: HubAction[] = [
    {
      id: 'users',
      label: 'کاربران',
      hint: overview
        ? overview.usersCount > 0
          ? `${formatFaNumber(overview.usersCount)} کاربر`
          : 'هنوز کاربری نیست'
        : 'مدیریت و جستجو',
      path: '/admin/users',
      tone: 'sky',
      Icon: RegularUserIcon,
    },
    {
      id: 'charges',
      label: 'رسیدها',
      hint: overview
        ? overview.pendingCharges > 0
          ? `${formatFaNumber(overview.pendingCharges)} در انتظار`
          : 'رسید بازی نیست'
        : 'تأیید کارت‌به‌کارت',
      path: '/admin/charges',
      tone: overview && overview.pendingCharges > 0 ? 'rose' : 'amber',
      Icon: PaymentHistoryIcon,
    },
    {
      id: 'tickets',
      label: 'تیکت پشتیبانی',
      hint: overview
        ? overview.openTickets > 0
          ? `${formatFaNumber(overview.openTickets)} باز`
          : 'تیکت بازی نیست'
        : 'پاسخ به کاربران',
      path: '/admin/tickets',
      tone: overview && overview.openTickets > 0 ? 'rose' : 'slate',
      Icon: Ticket02Icon,
    },
    {
      id: 'cards',
      label: 'کارت‌های واریز',
      hint: overview
        ? overview.activeCards > 0
          ? `${formatFaNumber(overview.activeCards)} کارت فعال`
          : 'کارتی ثبت نشده'
        : 'شماره کارت و شبا',
      path: '/admin/cards',
      tone: 'lime',
      Icon: BankCardIcon,
    },
    {
      id: 'panels',
      label: 'پنل‌های پاسارگارد',
      hint: 'افزودن و مدیریت پنل',
      path: '/admin/panels',
      tone: 'amber',
      Icon: ServerStack02Icon,
    },
    {
      id: 'payment-settings',
      label: 'پرداخت ترون',
      hint: 'TRX و کیف اصلی',
      path: '/admin/payment-settings',
      tone: 'teal',
      Icon: DepositCryptoIcon,
    },
    {
      id: 'system-channels',
      label: 'لیست کانال‌ها',
      hint: 'گزارش و قفل عضویت',
      path: '/admin/system-channels',
      tone: 'teal',
      Icon: LockIcon,
    },
  ]

  return (
    <div className="admin admin-page admin-hub">
      <div className="admin-hub__glow" aria-hidden="true" />

      <div className="admin-hub__header shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <div>
          <p className="admin-hub__eyebrow">مرکز فرمان</p>
          <h1 className="admin-hub__title">داشبورد ادمین</h1>
        </div>
        <div className="admin-hub__live">
          <span className="admin-hub__live-dot" />
          <span>آنلاین</span>
        </div>
      </div>

      <button
        type="button"
        className="admin-hub__hero shop-rise"
        style={{ '--rise-index': 1 } as CSSProperties}
        onClick={() => open('/admin/charges')}
      >
        <div className="admin-hub__hero-copy">
          <span className="admin-hub__hero-label">رسید در انتظار تأیید</span>
          <strong className="admin-hub__hero-value">
            {loading ? '…' : formatFaNumber(overview?.pendingCharges ?? 0)}
          </strong>
          <span className="admin-hub__hero-unit">درخواست کارت‌به‌کارت</span>
        </div>
        <div className="admin-hub__hero-meta">
          <span>کاربر {loading ? '…' : formatFaNumber(overview?.usersCount ?? 0)}</span>
          <span>کارت فعال {loading ? '…' : formatFaNumber(overview?.activeCards ?? 0)}</span>
          <span>
            تیکت باز {loading ? '…' : formatFaNumber(overview?.openTickets ?? 0)}
          </span>
        </div>
      </button>

      <div className="admin-hub__primary shop-rise" style={{ '--rise-index': 2 } as CSSProperties}>
        {primaryActions.map((action) => {
          const Icon = action.Icon
          return (
            <button
              key={action.id}
              type="button"
              className={`admin-hub__primary-tile admin-hub__tone--${action.tone}`}
              onClick={() => open(action.path)}
            >
              <span className="admin-hub__primary-icon">
                <Icon width={20} height={20} color="currentColor" />
              </span>
              <span className="admin-hub__primary-text">
                <span className="admin-hub__primary-label">{action.label}</span>
                <span className="admin-hub__primary-hint">{action.hint}</span>
              </span>
            </button>
          )
        })}
      </div>

      {error ? <p className="admin__error">{error}</p> : null}

      <div className="admin-hub__kpi shop-rise" style={{ '--rise-index': 3 } as CSSProperties}>
        <button type="button" className="admin-hub__kpi-item" onClick={() => open('/admin/users')}>
          <span className="admin-hub__kpi-label">کاربران</span>
          <span className="admin-hub__kpi-value">
            {loading ? '…' : formatFaNumber(overview?.usersCount ?? 0)}
          </span>
        </button>
        <button type="button" className="admin-hub__kpi-item" onClick={() => open('/admin/charges')}>
          <span className="admin-hub__kpi-label">رسیدها</span>
          <span
            className={`admin-hub__kpi-value${
              overview && overview.pendingCharges > 0 ? ' admin-hub__kpi-value--warn' : ''
            }`}
          >
            {loading ? '…' : formatFaNumber(overview?.pendingCharges ?? 0)}
          </span>
        </button>
        <button type="button" className="admin-hub__kpi-item" onClick={() => open('/admin/tickets')}>
          <span className="admin-hub__kpi-label">تیکت باز</span>
          <span
            className={`admin-hub__kpi-value${
              overview && overview.openTickets > 0 ? ' admin-hub__kpi-value--warn' : ''
            }`}
          >
            {loading ? '…' : formatFaNumber(overview?.openTickets ?? 0)}
          </span>
        </button>
        <button type="button" className="admin-hub__kpi-item" onClick={() => open('/admin/cards')}>
          <span className="admin-hub__kpi-label">کارت فعال</span>
          <span className="admin-hub__kpi-value">
            {loading ? '…' : formatFaNumber(overview?.activeCards ?? 0)}
          </span>
        </button>
      </div>

      <section className="admin-hub__ops shop-rise" style={{ '--rise-index': 4 } as CSSProperties}>
        <div className="admin-hub__panel-head" style={{ paddingInline: 'var(--page-padding-x)' }}>
          <div>
            <h2 className="admin-hub__panel-title">دسترسی سریع</h2>
            <p className="admin-hub__panel-sub">همه بخش‌های مدیریتی در یک نگاه</p>
          </div>
        </div>
        <div className="admin-hub__ops-grid">
          {primaryActions.map((action) => {
            const Icon = action.Icon
            return (
              <button
                key={`ops-${action.id}`}
                type="button"
                className={`admin-hub__ops-tile admin-hub__tone--${action.tone}`}
                onClick={() => open(action.path)}
              >
                <span className="admin-hub__ops-icon">
                  <Icon width={18} height={18} color="currentColor" />
                </span>
                <span className="admin-hub__ops-label">{action.label}</span>
                <span className="admin-hub__ops-hint">
                  {action.id === 'charges' && overview
                    ? formatFaNumber(overview.pendingCharges)
                    : action.id === 'users' && overview
                      ? formatFaNumber(overview.usersCount)
                      : action.id === 'cards' && overview
                        ? formatFaNumber(overview.activeCards)
                        : action.id === 'tickets' && overview
                          ? formatFaNumber(overview.openTickets)
                          : '—'}
                </span>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
