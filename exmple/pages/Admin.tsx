import { useEffect, useLayoutEffect, useMemo, useState, type ComponentType, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import AdminIcon from '../components/icons/AdminIcon'
import BankCardIcon from '../components/icons/BankCardIcon'
import ContactIcon from '../components/icons/ContactIcon'
import DepositCryptoIcon from '../components/icons/DepositCryptoIcon'
import FavouriteIcon from '../components/icons/FavouriteIcon'
import IdIcon from '../components/icons/IdIcon'
import MoneySendFlow02Icon from '../components/icons/money-send-flow-02-stroke-rounded'
import OrderIcon from '../components/icons/OrderIcon'
import PaymentHistoryIcon from '../components/icons/PaymentHistoryIcon'
import RegularUserIcon from '../components/icons/RegularUserIcon'
import TelegramIcon from '../components/icons/TelegramIcon'
import ViewIcon from '../components/icons/ViewIcon'
import { useAdminAccess } from '../hooks/useAdminAccess'
import { useTelegram } from '../hooks/useTelegram'
import { fetchAdminOverview, type AdminOverview } from '../lib/adminApi'
import {
  restoreAdminHubScroll,
  restoreAdminHubScrollSync,
  saveAdminHubScroll,
} from '../lib/adminScroll'
import { balanceToToman } from '../lib/api'
import {
  displayUsername,
  formatFaDateLong,
  formatFaNumber,
  orderStatusBadgeClass,
  orderStatusLabel,
  orderTitle,
} from './admin/adminLabels'
import { AdminSalesChart } from './admin/AdminSalesChart'
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

const PRIMARY_ACTIONS: HubAction[] = [
  {
    id: 'users',
    label: 'کاربران',
    hint: 'مدیریت و جستجو',
    path: '/admin/users',
    tone: 'sky',
    Icon: RegularUserIcon,
  },
  {
    id: 'orders',
    label: 'سفارش‌ها',
    hint: 'پیگیری فروش',
    path: '/admin/orders',
    tone: 'teal',
    Icon: PaymentHistoryIcon,
  },
  {
    id: 'payments',
    label: 'پرداخت‌ها',
    hint: 'درگاه و استعلام',
    path: '/admin/payments',
    tone: 'lime',
    Icon: BankCardIcon,
  },
  {
    id: 'analytics',
    label: 'آمار',
    hint: 'بازدید و رشد',
    path: '/admin/analytics',
    tone: 'amber',
    Icon: ViewIcon,
  },
]

/** Keep last hub payload so returning to /admin paints full height before scroll restore. */
let cachedAdminOverview: AdminOverview | null = null

function CategoryBars({
  rows,
  onOpen,
}: {
  rows: AdminOverview['today']['salesByCategory']
  onOpen: (path: string) => void
}) {
  const max = Math.max(...rows.map((row) => Number(row.amountToman) || 0), 1)
  return (
    <div className="admin-hub__bars">
      {rows.slice(0, 5).map((row) => {
        const width = Math.max(8, Math.round((Number(row.amountToman) / max) * 100))
        return (
          <button
            key={row.slug}
            type="button"
            className="admin-hub__bar-row"
            onClick={() => onOpen(`/admin/orders?category=${row.slug}`)}
          >
            <div className="admin-hub__bar-head">
              <span>{row.label}</span>
              <span>{formatFaNumber(balanceToToman(row.amountToman))}</span>
            </div>
            <div className="admin-hub__bar-track">
              <div className="admin-hub__bar-fill" style={{ width: `${width}%` }} />
            </div>
          </button>
        )
      })}
    </div>
  )
}

export function AdminPage() {
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const { ready, allowed } = useAdminAccess()
  const [overview, setOverview] = useState<AdminOverview | null>(() => cachedAdminOverview)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(() => !cachedAdminOverview)
  const [chartRange, setChartRange] = useState<'weekly' | 'monthly'>('weekly')

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

  useLayoutEffect(() => {
    if (!ready || !allowed) return
    restoreAdminHubScrollSync()
  }, [allowed, overview, ready])

  useEffect(() => {
    if (!ready || !allowed || loading) return
    restoreAdminHubScroll()
  }, [allowed, loading, overview, ready])

  const chartTotal = useMemo(() => {
    if (!overview) return 0
    const series = chartRange === 'weekly' ? overview.charts.weekly : overview.charts.monthly
    return series.reduce((sum, point) => sum + (Number(point.amountToman) || 0), 0)
  }, [chartRange, overview])

  if (!ready || !allowed) return null

  const open = (path: string) => {
    haptic('light')
    saveAdminHubScroll()
    navigate(path)
  }

  const opsActions: HubAction[] = [
    {
      id: 'kyc',
      label: 'احراز هویت',
      hint: 'ناقص‌ها',
      path: '/admin/kyc',
      tone: 'rose',
      Icon: IdIcon,
      meta: overview ? formatFaNumber(overview.users.kycPending) : undefined,
    },
    {
      id: 'failed',
      label: 'ناموفق',
      hint: 'سفارش‌ها',
      path: '/admin/orders?status=failed',
      tone: 'rose',
      Icon: PaymentHistoryIcon,
      meta: overview ? formatFaNumber(overview.today.failedCount) : undefined,
    },
    {
      id: 'crypto',
      label: 'ترون',
      hint: 'کریپتو',
      path: '/admin/crypto',
      tone: 'teal',
      Icon: DepositCryptoIcon,
    },
    {
      id: 'transfers',
      label: 'انتقال',
      hint: 'کیف پول',
      path: '/admin/transfers',
      tone: 'sky',
      Icon: MoneySendFlow02Icon,
      meta: overview ? formatFaNumber(overview.today.transfersCount) : undefined,
    },
    {
      id: 'club',
      label: 'کلاب',
      hint: 'جوایز',
      path: '/admin/club',
      tone: 'amber',
      Icon: FavouriteIcon,
    },
    {
      id: 'discounts',
      label: 'تخفیف',
      hint: 'کدها',
      path: '/admin/discounts',
      tone: 'lime',
      Icon: FavouriteIcon,
    },
    {
      id: 'shop-banners',
      label: 'بنر',
      hint: 'فروشگاه',
      path: '/admin/shop-banners',
      tone: 'amber',
      Icon: ViewIcon,
    },
    {
      id: 'account-plans',
      label: 'پلن اکانت',
      hint: 'فروشگاه',
      path: '/admin/account-plans',
      tone: 'teal',
      Icon: IdIcon,
    },
    {
      id: 'account-orders',
      label: 'سفارش اکانت',
      hint: 'تحویل',
      path: '/admin/account-orders',
      tone: 'lime',
      Icon: OrderIcon,
    },
    {
      id: 'pricing',
      label: 'قیمت',
      hint: 'محصولات',
      path: '/admin/pricing',
      tone: 'slate',
      Icon: BankCardIcon,
    },
    {
      id: 'tickets',
      label: 'تیکت',
      hint: 'پشتیبانی',
      path: '/admin/tickets',
      tone: 'sky',
      Icon: ContactIcon,
    },
    {
      id: 'system-channels',
      label: 'کانال‌ها',
      hint: 'سیستم',
      path: '/admin/system-channels',
      tone: 'teal',
      Icon: TelegramIcon,
    },
    {
      id: 'tools',
      label: 'ابزار',
      hint: 'فنی',
      path: '/admin/tools',
      tone: 'slate',
      Icon: AdminIcon,
    },
    {
      id: 'banned',
      label: 'بن‌شده',
      hint: 'کاربران',
      path: '/admin/users?banned=1',
      tone: 'rose',
      Icon: RegularUserIcon,
      meta: overview ? formatFaNumber(overview.users.banned) : undefined,
    },
  ]

  const openTickets = overview?.tickets?.openCount ?? 0
  const primaryActions: HubAction[] = PRIMARY_ACTIONS.map((action) => {
    if (action.id === 'users') {
      return {
        ...action,
        hint: overview
          ? overview.users.newToday > 0
            ? `${formatFaNumber(overview.users.newToday)} کاربر جدید`
            : 'کاربر جدیدی نیست'
          : action.hint,
      }
    }
    if (action.id === 'orders') {
      return {
        ...action,
        hint: overview
          ? overview.today.ordersCount > 0
            ? `${formatFaNumber(overview.today.ordersCount)} سفارش جدید`
            : 'سفارش جدیدی نیست'
          : action.hint,
      }
    }
    return action
  })

  const ticketsAction: HubAction = {
    id: 'tickets',
    label: 'تیکت پشتیبانی',
    hint: overview
      ? openTickets > 0
        ? `${formatFaNumber(openTickets)} تیکت باز داریم`
        : 'تیکت بازی نیست'
      : 'وضعیت پشتیبانی',
    path: '/admin/tickets',
    tone: openTickets > 0 ? 'rose' : 'sky',
    Icon: ContactIcon,
  }

  const chartPoints =
    chartRange === 'weekly' ? overview?.charts.weekly ?? [] : overview?.charts.monthly ?? []

  const salesToday = loading
    ? '…'
    : formatFaNumber(balanceToToman(overview?.today.completedAmountToman ?? 0))

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
          <span>
            {loading ? '…' : formatFaNumber(overview?.online.onlineCount ?? 0)} آنلاین
          </span>
        </div>
      </div>

      <button
        type="button"
        className="admin-hub__hero shop-rise"
        style={{ '--rise-index': 1 } as CSSProperties}
        onClick={() => open('/admin/analytics')}
      >
        <div className="admin-hub__hero-copy">
          <span className="admin-hub__hero-label">فروش امروز</span>
          <strong className="admin-hub__hero-value">{salesToday}</strong>
          <span className="admin-hub__hero-unit">تومان</span>
        </div>
        <div className="admin-hub__hero-spark" aria-hidden="true">
          {!loading && overview && <AdminSalesChart points={overview.charts.weekly} compact />}
        </div>
        <div className="admin-hub__hero-meta">
          <span>
            سفارش {loading ? '…' : formatFaNumber(overview?.today.ordersCount ?? 0)}
          </span>
          <span>
            موفق {loading ? '…' : formatFaNumber(overview?.today.completedCount ?? 0)}
          </span>
          <span>
            جدید {loading ? '…' : formatFaNumber(overview?.users.newToday ?? 0)}
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
        {(() => {
          const TicketsIcon = ticketsAction.Icon
          return (
            <button
              type="button"
              className={`admin-hub__primary-tile admin-hub__primary-tile--wide admin-hub__tone--${ticketsAction.tone}`}
              onClick={() => open(ticketsAction.path)}
            >
              <span className="admin-hub__primary-icon">
                <TicketsIcon width={20} height={20} color="currentColor" />
              </span>
              <span className="admin-hub__primary-text">
                <span className="admin-hub__primary-label">{ticketsAction.label}</span>
                <span className="admin-hub__primary-hint">{ticketsAction.hint}</span>
              </span>
            </button>
          )
        })()}
      </div>

      {error && <p className="admin__error">{error}</p>}

      <div className="admin-hub__kpi shop-rise" style={{ '--rise-index': 3 } as CSSProperties}>
        <button type="button" className="admin-hub__kpi-item" onClick={() => open('/admin/orders')}>
          <span className="admin-hub__kpi-label">کل سفارش</span>
          <span className="admin-hub__kpi-value">
            {loading ? '…' : formatFaNumber(overview?.totals.orders ?? 0)}
          </span>
        </button>
        <button type="button" className="admin-hub__kpi-item" onClick={() => open('/admin/users')}>
          <span className="admin-hub__kpi-label">کاربران</span>
          <span className="admin-hub__kpi-value">
            {loading ? '…' : formatFaNumber(overview?.users.total ?? 0)}
          </span>
        </button>
        <button type="button" className="admin-hub__kpi-item" onClick={() => open('/admin/kyc')}>
          <span className="admin-hub__kpi-label">KYC ناقص</span>
          <span className="admin-hub__kpi-value admin-hub__kpi-value--warn">
            {loading ? '…' : formatFaNumber(overview?.users.kycPending ?? 0)}
          </span>
        </button>
        <button
          type="button"
          className="admin-hub__kpi-item"
          onClick={() => open('/admin/orders?status=failed')}
        >
          <span className="admin-hub__kpi-label">ناموفق امروز</span>
          <span className="admin-hub__kpi-value admin-hub__kpi-value--danger">
            {loading ? '…' : formatFaNumber(overview?.today.failedCount ?? 0)}
          </span>
        </button>
      </div>

      <section className="admin-hub__panel shop-rise" style={{ '--rise-index': 4 } as CSSProperties}>
          <div className="admin-hub__panel-head">
            <div>
              <h2 className="admin-hub__panel-title">عملکرد فروش</h2>
              <p className="admin-hub__panel-sub">
                جمع {chartRange === 'weekly' ? '۷ روز' : '۳۰ روز'}{' '}
                {formatFaNumber(balanceToToman(chartTotal))} تومان
              </p>
            </div>
            <div className="admin-hub__segment">
              <button
                type="button"
                className={`admin-hub__segment-btn${chartRange === 'weekly' ? ' is-active' : ''}`}
                onClick={() => setChartRange('weekly')}
              >
                ۷ روز
              </button>
              <button
                type="button"
                className={`admin-hub__segment-btn${chartRange === 'monthly' ? ' is-active' : ''}`}
                onClick={() => setChartRange('monthly')}
              >
                ۳۰ روز
              </button>
            </div>
          </div>
          {loading ? (
            <p className="admin__muted" style={{ margin: 0 }}>
              در حال بارگذاری…
            </p>
          ) : chartPoints.length === 0 ? (
            <EmptyState compact title="هنوز فروشی ثبت نشده" style={{ margin: 0 }} />
          ) : (
            <AdminSalesChart
              points={chartPoints}
              onSelect={() => haptic('light')}
            />
          )}
        </section>

        {!loading && overview && overview.today.salesByCategory.length > 0 && (
          <section className="admin-hub__panel shop-rise" style={{ '--rise-index': 5 } as CSSProperties}>
            <div className="admin-hub__panel-head">
              <div>
                <h2 className="admin-hub__panel-title">فروش امروز هر دسته</h2>
                <p className="admin-hub__panel-sub">برای فیلتر سفارش‌ها لمس کنید</p>
              </div>
            </div>
            <CategoryBars rows={overview.today.salesByCategory} onOpen={open} />
          </section>
        )}

        {!loading && overview && overview.bestSellers.length > 0 && (
          <section className="admin-hub__panel shop-rise" style={{ '--rise-index': 6 } as CSSProperties}>
            <div className="admin-hub__panel-head">
              <div>
                <h2 className="admin-hub__panel-title">محصولات پرفروش</h2>
                <p className="admin-hub__panel-sub">بر اساس سفارش‌های موفق</p>
              </div>
            </div>
            <div className="admin-hub__rank-list">
              {overview.bestSellers.slice(0, 5).map((row, index) => (
                <button
                  key={row.slug}
                  type="button"
                  className="admin-hub__rank-item"
                  onClick={() => open(`/admin/orders?category=${row.slug}`)}
                >
                  <span className="admin-hub__rank-index">{formatFaNumber(index + 1)}</span>
                  <span className="admin-hub__rank-body">
                    <span className="admin-hub__rank-title">{row.label}</span>
                    <span className="admin-hub__rank-meta">
                      {formatFaNumber(row.count)} سفارش موفق
                    </span>
                  </span>
                  <span className="admin-hub__rank-amount">
                    {formatFaNumber(balanceToToman(row.amountToman))}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {!loading && overview && overview.latestOrders.length > 0 && (
          <section className="admin-hub__panel shop-rise" style={{ '--rise-index': 7 } as CSSProperties}>
            <div className="admin-hub__panel-head">
              <div>
                <h2 className="admin-hub__panel-title">آخرین سفارش‌ها</h2>
                <p className="admin-hub__panel-sub">فعالیت لحظه‌ای فروشگاه</p>
              </div>
              <button
                type="button"
                className="admin-hub__link"
                onClick={() => open('/admin/orders')}
              >
                همه
              </button>
            </div>
            <div className="admin-hub__feed">
              {overview.latestOrders.map((order) => (
                <button
                  key={order.orderId}
                  type="button"
                  className="admin-hub__feed-item"
                  onClick={() =>
                    open(
                      order.category.slug === 'chatgpt'
                        ? `/admin/account-orders/${encodeURIComponent(order.orderId)}`
                        : `/admin/orders/${encodeURIComponent(order.orderId)}`,
                    )
                  }
                >
                  <div className="admin-hub__feed-top">
                    <span className="admin-hub__feed-title">
                      {orderTitle(order.category.label, balanceToToman(order.amountToman))}
                    </span>
                    <span className={orderStatusBadgeClass(order.status)}>
                      {orderStatusLabel(order.status)}
                    </span>
                  </div>
                  <div className="admin-hub__feed-meta">
                    {displayUsername(order.user)} · {formatFaDateLong(order.createdAt)}
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="admin-hub__ops shop-rise" style={{ '--rise-index': 8 } as CSSProperties}>
          <div className="admin-hub__panel-head" style={{ paddingInline: 'var(--page-padding-x)' }}>
            <div>
              <h2 className="admin-hub__panel-title">دسترسی سریع</h2>
              <p className="admin-hub__panel-sub">همه بخش‌های مدیریتی در یک نگاه</p>
            </div>
          </div>
          <div className="admin-hub__ops-grid">
            {opsActions.map((action) => {
              const Icon = action.Icon
              return (
                <button
                  key={action.id}
                  type="button"
                  className={`admin-hub__ops-tile admin-hub__tone--${action.tone}`}
                  onClick={() => open(action.path)}
                >
                  <span className="admin-hub__ops-icon">
                    <Icon width={18} height={18} color="currentColor" />
                  </span>
                  <span className="admin-hub__ops-label">{action.label}</span>
                  <span className="admin-hub__ops-hint">
                    {action.meta ? action.meta : action.hint}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        <div style={{ height: 20 }} />
    </div>
  )
}
