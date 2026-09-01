import { useEffect, useState, type ComponentType, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import BankCardIcon from '../components/icons/BankCardIcon'
import LockIcon from '../components/icons/LockIcon'
import MoneyBagIcon from '../components/icons/MoneyBagIcon'
import ServerStack02Icon from '../components/icons/server-stack-02-stroke-rounded'
import DepositCryptoIcon from '../components/icons/DepositCryptoIcon'
import PaymentHistoryIcon from '../components/icons/PaymentHistoryIcon'
import RegularUserIcon from '../components/icons/RegularUserIcon'
import Ticket02Icon from '../components/icons/ticket-02-stroke-rounded'
import ComplaintIcon from '../components/icons/complaint-stroke-rounded'
import ChartRoseIcon from '../components/icons/chart-rose-stroke-rounded'
import { useAdminAccess } from '../hooks/useAdminAccess'
import { useTelegram } from '../hooks/useTelegram'
import { formatFaTrafficParts } from '../lib/formatTraffic'
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
  layout?: 'wide' | 'compact'
}

function formatFaNumber(value: number) {
  return Math.trunc(Number(value) || 0).toLocaleString('fa-IR')
}

function trafficPartsFromBytes(bytes: string | number | null | undefined) {
  const value = Number(bytes ?? 0)
  if (!Number.isFinite(value) || value <= 0) return formatFaTrafficParts(0)
  return formatFaTrafficParts(value / 1024 ** 3)
}

let cachedAdminOverview: AdminOverview | null = null

function readCachedOverview() {
  if (cachedAdminOverview && !cachedAdminOverview.today) {
    cachedAdminOverview = null
  }
  return cachedAdminOverview
}

function HubTile({
  action,
  onOpen,
}: {
  action: HubAction
  onOpen: (path: string) => void
}) {
  const Icon = action.Icon
  const compact = action.layout === 'compact'

  return (
    <button
      type="button"
      className={`admin-hub__primary-tile admin-hub__tone--${action.tone}${
        action.layout === 'wide' ? ' admin-hub__primary-tile--wide' : ''
      }${compact ? ' admin-hub__primary-tile--compact' : ''}`}
      onClick={() => onOpen(action.path)}
    >
      <span className="admin-hub__primary-icon">
        <Icon width={compact ? 18 : 20} height={compact ? 18 : 20} color="currentColor" />
      </span>
      <span className="admin-hub__primary-text">
        <span className="admin-hub__primary-label">{action.label}</span>
        <span className="admin-hub__primary-hint">{action.hint}</span>
      </span>
    </button>
  )
}

export function AdminPage() {
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const { ready, allowed } = useAdminAccess()
  const [overview, setOverview] = useState<AdminOverview | null>(() => readCachedOverview())
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(() => !readCachedOverview())

  useEffect(() => {
    if (!ready || !allowed) return
    let cancelled = false
    if (!readCachedOverview()) setLoading(true)
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

  const pendingCharges = overview?.pendingCharges ?? 0
  const openTickets = overview?.openTickets ?? 0

  const usersAction: HubAction = {
    id: 'users',
    label: 'کاربران',
    hint: overview
      ? `${formatFaNumber(overview.usersCount)} کاربر ثبت‌شده`
      : 'مدیریت و جستجو',
    path: '/admin/users',
    tone: 'sky',
    layout: 'wide',
    Icon: RegularUserIcon,
  }

  const chargesAction: HubAction = {
    id: 'charges',
    label: 'رسیدها',
    hint: overview
      ? pendingCharges > 0
        ? `${formatFaNumber(pendingCharges)} در انتظار تأیید`
        : 'رسید بازی نیست'
      : 'تأیید کارت‌به‌کارت',
    path: '/admin/charges',
    tone: pendingCharges > 0 ? 'rose' : 'amber',
    Icon: PaymentHistoryIcon,
  }

  const ticketsAction: HubAction = {
    id: 'tickets',
    label: 'تیکت پشتیبانی',
    hint: overview
      ? openTickets > 0
        ? `${formatFaNumber(openTickets)} تیکت باز`
        : 'تیکت بازی نیست'
      : 'پاسخ به کاربران',
    path: '/admin/tickets',
    tone: openTickets > 0 ? 'rose' : 'slate',
    Icon: Ticket02Icon,
  }

  const cardsAction: HubAction = {
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
  }

  const panelsAction: HubAction = {
    id: 'panels',
    label: 'پنل‌های پاسارگارد',
    hint: 'افزودن و مدیریت پنل',
    path: '/admin/panels',
    tone: 'amber',
    Icon: ServerStack02Icon,
  }

  const usageInvoicesAction: HubAction = {
    id: 'usage-invoices',
    label: 'فاکتورهای مصرف',
    hint: overview?.today.usageBillingCount
      ? `${formatFaNumber(overview.today.usageBillingCount)} فاکتور امروز`
      : 'رتبه کاربران و پنل‌ها',
    path: '/admin/usage-invoices',
    tone: 'teal',
    layout: 'wide',
    Icon: ChartRoseIcon,
  }

  const settingsActions: HubAction[] = [
    {
      id: 'pricing-settings',
      label: 'قیمت‌گذاری',
      hint: 'نرخ هر گیگابایت',
      path: '/admin/pricing-settings',
      tone: 'amber',
      layout: 'compact',
      Icon: MoneyBagIcon,
    },
    {
      id: 'payment-settings',
      label: 'پرداخت ترون',
      hint: 'TRX و کیف اصلی',
      path: '/admin/payment-settings',
      tone: 'teal',
      layout: 'compact',
      Icon: DepositCryptoIcon,
    },
    {
      id: 'support-settings',
      label: 'یوزرنیم کارشناس',
      hint: 'آیدی تلگرام پشتیبانی',
      path: '/admin/support-settings',
      tone: 'slate',
      layout: 'compact',
      Icon: ComplaintIcon,
    },
    {
      id: 'system-channels',
      label: 'لیست کانال‌ها',
      hint: 'گزارش و قفل عضویت',
      path: '/admin/system-channels',
      tone: 'teal',
      layout: 'compact',
      Icon: LockIcon,
    },
  ]

  const usageTrafficParts = loading
    ? { amount: '…', unit: 'گیگ' }
    : trafficPartsFromBytes(overview?.today.usageTrafficBytes)
  const usageAmount = loading
    ? '…'
    : formatFaNumber(overview?.today.usageAmountIrt ?? 0)
  const usageUsers = loading ? '…' : formatFaNumber(overview?.today.usageUsersCount ?? 0)
  const chargesAmount = loading
    ? '…'
    : formatFaNumber(overview?.today.chargesAmountIrt ?? 0)
  const chargesCount = loading ? '…' : formatFaNumber(overview?.today.chargesCount ?? 0)
  const chargesUsers = loading ? '…' : formatFaNumber(overview?.today.chargesUsersCount ?? 0)

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

      <section
        className="admin-hub__hero admin-hub__hero--dual shop-rise"
        style={{ '--rise-index': 1 } as CSSProperties}
        aria-label="آمار امروز"
      >
        <div className="admin-hub__hero-stat">
          <span className="admin-hub__hero-label">مصرف روزانه کاربران</span>
          <div className="admin-hub__hero-traffic">
            <strong className="admin-hub__hero-value admin-hub__hero-value--sm">
              {usageTrafficParts.amount}
            </strong>
            <span className="admin-hub__hero-traffic-unit">{usageTrafficParts.unit}</span>
          </div>
          <span className="admin-hub__hero-unit">{usageAmount} تومان صورتحساب</span>
          <div className="admin-hub__hero-foot">
            <span>{usageUsers} کاربر فعال</span>
            {!loading && overview && overview.today.usageBillingCount > 0 ? (
              <span>{formatFaNumber(overview.today.usageBillingCount)} صورتحساب</span>
            ) : null}
          </div>
        </div>

        <div className="admin-hub__hero-divider" aria-hidden="true" />

        <div className="admin-hub__hero-stat">
          <span className="admin-hub__hero-label">شارژ حساب امروز</span>
          <strong className="admin-hub__hero-value admin-hub__hero-value--sm">{chargesAmount}</strong>
          <span className="admin-hub__hero-unit">تومان</span>
          <div className="admin-hub__hero-foot">
            <span>{chargesCount} تراکنش</span>
            <span>{chargesUsers} کاربر</span>
          </div>
        </div>

        {!loading && pendingCharges > 0 ? (
          <button
            type="button"
            className="admin-hub__hero-alert"
            onClick={() => open('/admin/charges')}
          >
            {formatFaNumber(pendingCharges)} رسید در انتظار تأیید
          </button>
        ) : null}
      </section>

      <section className="admin-hub__section shop-rise" style={{ '--rise-index': 2 } as CSSProperties}>
        <div className="admin-hub__section-head">
          <h2 className="admin-hub__section-title">مدیریت</h2>
          <p className="admin-hub__section-sub">کاربران، پرداخت و پشتیبانی</p>
        </div>

        <div className="admin-hub__bento">
          <HubTile action={usersAction} onOpen={open} />
          <HubTile action={usageInvoicesAction} onOpen={open} />

          <div className="admin-hub__bento-pair">
            <HubTile action={chargesAction} onOpen={open} />
            <HubTile action={ticketsAction} onOpen={open} />
          </div>

          <div className="admin-hub__bento-pair">
            <HubTile action={cardsAction} onOpen={open} />
            <HubTile action={panelsAction} onOpen={open} />
          </div>
        </div>
      </section>

      {error ? <p className="admin__error">{error}</p> : null}

      <section className="admin-hub__section shop-rise" style={{ '--rise-index': 3 } as CSSProperties}>
        <div className="admin-hub__section-head">
          <h2 className="admin-hub__section-title">تنظیمات</h2>
          <p className="admin-hub__section-sub">قیمت، پرداخت و سیستم</p>
        </div>

        <div className="admin-hub__settings-grid">
          {settingsActions.map((action) => (
            <HubTile key={action.id} action={action} onOpen={open} />
          ))}
        </div>
      </section>
    </div>
  )
}
