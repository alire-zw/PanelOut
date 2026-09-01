import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { Notification } from '../components/Notification'
import { PageHeader } from '../components/PageHeader'
import { SolarIcon } from '../components/SolarIcon'
import { UsageInvoiceDetailSheet } from '../components/UsageInvoiceDetailSheet'
import { useAdminAccess } from '../hooks/useAdminAccess'
import { useTelegram } from '../hooks/useTelegram'
import { formatFaTrafficFromBytes } from '../lib/formatTraffic'
import {
  fetchAdminUsageInvoices,
  type AdminUsageInvoiceItem,
  type AdminUsageInvoicesPayload,
  type UsageInvoiceRange,
} from '../lib/paymentsApi'
import { isTelegramWebApp } from '../lib/telegram'
import '../styles/shop-rise.css'
import './Admin.css'
import './AdminUsageInvoices.css'

const RANGE_TABS: Array<{
  id: UsageInvoiceRange
  label: string
  icon: `solar:${string}`
}> = [
  { id: 'today', label: 'امروز', icon: 'solar:sun-2-bold-duotone' },
  { id: 'week', label: '۷ روز', icon: 'solar:calendar-minimalistic-bold-duotone' },
  { id: 'month', label: '۳۰ روز', icon: 'solar:calendar-bold-duotone' },
  { id: 'all', label: 'همه', icon: 'solar:infinity-bold-duotone' },
]

type LeaderTab = 'users' | 'panels'

function formatFaNumber(value: number) {
  return Math.trunc(Number(value) || 0).toLocaleString('fa-IR')
}

function panelServiceLabel(type: string) {
  if (type === 'panel_trial') return 'آزمایشی'
  if (type === 'panel_usage') return 'مصرفی'
  if (type === 'panel_reseller') return 'ریسلری'
  if (type === 'panel_unlimited') return 'نامحدود'
  if (type === 'outbound_volume') return 'اوتباند حجمی'
  if (type === 'outbound_usage') return 'اوتباند مصرفی'
  return type
}

function trafficLabel(bytes: string | number) {
  return formatFaTrafficFromBytes(bytes)
}

function formatInvoiceDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('fa-IR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function InvoiceSkeleton({ index }: { index: number }) {
  return (
    <li>
      <div
        className="admin-usage-invoices__tx admin-usage-invoices__tx--skeleton shop-rise"
        style={{ '--rise-index': Math.min(index + 3, 10) } as CSSProperties}
        aria-hidden
      >
        <div className="admin-usage-invoices__tx-start">
          <span className="admin-usage-skel admin-usage-skel--icon" />
          <div className="admin-usage-invoices__tx-body">
            <span className="admin-usage-skel admin-usage-skel--title" />
            <span className="admin-usage-skel admin-usage-skel--meta" />
          </div>
        </div>
        <span className="admin-usage-skel admin-usage-skel--amount" />
      </div>
    </li>
  )
}

export function AdminUsageInvoicesPage() {
  const navigate = useNavigate()
  const { ready } = useAdminAccess()
  const { haptic } = useTelegram()

  const [range, setRange] = useState<UsageInvoiceRange>('week')
  const [leaderTab, setLeaderTab] = useState<LeaderTab>('users')
  const [payload, setPayload] = useState<AdminUsageInvoicesPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedInvoice, setSelectedInvoice] = useState<AdminUsageInvoiceItem | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  }>({ show: false, message: '', type: 'error' })

  const load = useCallback(
    async (nextRange: UsageInvoiceRange, append = false, itemOffset = 0) => {
      if (append) setLoadingMore(true)
      else setLoading(true)

      try {
        const data = await fetchAdminUsageInvoices({
          range: nextRange,
          limit: 40,
          offset: itemOffset,
        })

        setPayload((prev) => {
          if (!append || !prev || prev.range !== nextRange) return data
          return {
            ...data,
            items: [...prev.items, ...data.items],
          }
        })
        setError(null)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'خطا در دریافت فاکتورها'
        if (!append) {
          setPayload(null)
          setError(message)
        }
        setNotification({ show: true, message, type: 'error' })
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (!ready) return
    void load(range, false, 0)
  }, [ready, range, load])

  useEffect(() => {
    if (!isTelegramWebApp()) return
    const backButton = window.Telegram?.WebApp.BackButton
    if (!backButton) return
    const handleBack = () => navigate('/admin')
    backButton.show()
    backButton.onClick(handleBack)
    return () => {
      backButton.hide()
      backButton.offClick(handleBack)
    }
  }, [navigate])

  if (!ready) return null

  const summary = payload?.summary
  const maxServiceAmount = Math.max(
    ...(payload?.byServiceType.map((row) => row.amountIrt) ?? [1]),
    1,
  )

  const openInvoice = (invoice: AdminUsageInvoiceItem) => {
    haptic('light')
    setSelectedInvoice(invoice)
    setDetailOpen(true)
  }

  const openUserProfile = (telegramUserId: number) => {
    haptic('light')
    setDetailOpen(false)
    navigate(`/admin/users/${telegramUserId}`)
  }

  const hasLeaders =
    !loading &&
    payload &&
    (payload.topUsers.length > 0 || payload.topPanels.length > 0)

  return (
    <div className="admin-section admin-usage-invoices">
      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification((prev) => ({ ...prev, show: false }))}
      />

      <UsageInvoiceDetailSheet
        isOpen={detailOpen}
        invoice={selectedInvoice}
        onClose={() => setDetailOpen(false)}
        onOpenUser={openUserProfile}
      />

      <PageHeader title="فاکتورهای مصرف" onBack={() => navigate('/admin')} />

      <div
        className="admin-tabs admin-tabs--4 shop-rise"
        style={{ '--rise-index': 0 } as CSSProperties}
        role="tablist"
      >
        {RANGE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={range === tab.id}
            className={`admin-tabs__btn${range === tab.id ? ' admin-tabs__btn--active' : ''}`}
            onClick={() => {
              haptic('light')
              setRange(tab.id)
            }}
          >
            <SolarIcon icon={tab.icon} width={15} height={15} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {error && !loading ? <p className="admin-status admin-status--error">{error}</p> : null}

      <div
        className="admin-usage-invoices__summary shop-rise"
        style={{ '--rise-index': 1 } as CSSProperties}
      >
        <div className="admin-usage-invoices__kpi">
          <div>
            <span>جمع فاکتور</span>
            <strong>{loading ? '…' : formatFaNumber(summary?.amountIrt ?? 0)}</strong>
            <em>تومان</em>
          </div>
          <div>
            <span>ترافیک</span>
            <strong className="admin-usage-invoices__traffic">
              {loading ? '…' : trafficLabel(summary?.trafficBytes ?? 0).amount}
            </strong>
            <em>{loading ? '' : trafficLabel(summary?.trafficBytes ?? 0).unit}</em>
          </div>
          <div>
            <span>تعداد</span>
            <strong>{loading ? '…' : formatFaNumber(summary?.invoiceCount ?? 0)}</strong>
            <em>فاکتور</em>
          </div>
          <div>
            <span>کاربر</span>
            <strong>{loading ? '…' : formatFaNumber(summary?.usersCount ?? 0)}</strong>
            <em>نفر</em>
          </div>
        </div>
      </div>

      {!loading && payload && payload.byServiceType.length > 0 ? (
        <section
          className="admin-usage-invoices__panel shop-rise"
          style={{ '--rise-index': 2 } as CSSProperties}
        >
          <h2 className="admin-usage-invoices__panel-title">تفکیک نوع پنل</h2>
          <div className="admin-usage-invoices__bars">
            {payload.byServiceType.map((row) => {
              const width = Math.max(8, Math.round((row.amountIrt / maxServiceAmount) * 100))
              const parts = trafficLabel(row.trafficBytes)
              return (
                <div key={row.serviceType} className="admin-usage-invoices__bar-row">
                  <div className="admin-usage-invoices__bar-head">
                    <span>{panelServiceLabel(row.serviceType)}</span>
                    <span>{formatFaNumber(row.amountIrt)} تومان</span>
                  </div>
                  <div className="admin-usage-invoices__bar-track">
                    <div className="admin-usage-invoices__bar-fill" style={{ width: `${width}%` }} />
                  </div>
                  <p className="admin-usage-invoices__bar-meta">
                    {formatFaNumber(row.invoiceCount)} فاکتور · {parts.amount} {parts.unit}
                  </p>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      {hasLeaders ? (
        <section
          className="admin-usage-invoices__panel admin-usage-invoices__leaders shop-rise"
          style={{ '--rise-index': 3 } as CSSProperties}
        >
          <div className="admin-usage-invoices__leaders-head">
            <h2 className="admin-usage-invoices__panel-title">برترین‌ها</h2>
            <div className="admin-usage-invoices__seg" role="tablist" aria-label="نوع برترین">
              <button
                type="button"
                role="tab"
                aria-selected={leaderTab === 'users'}
                className={`admin-usage-invoices__seg-btn${
                  leaderTab === 'users' ? ' is-active' : ''
                }`}
                onClick={() => {
                  haptic('light')
                  setLeaderTab('users')
                }}
              >
                کاربران
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={leaderTab === 'panels'}
                className={`admin-usage-invoices__seg-btn${
                  leaderTab === 'panels' ? ' is-active' : ''
                }`}
                onClick={() => {
                  haptic('light')
                  setLeaderTab('panels')
                }}
              >
                پنل‌ها
              </button>
            </div>
          </div>

          <div className="admin-usage-invoices__leader-list">
            {leaderTab === 'users'
              ? payload!.topUsers.slice(0, 5).map((row, index) => (
                  <div key={row.telegramUserId} className="admin-usage-invoices__leader-row">
                    <span className="admin-usage-invoices__leader-rank">
                      {formatFaNumber(index + 1)}
                    </span>
                    <span className="admin-usage-invoices__leader-name">{row.displayName}</span>
                    <span className="admin-usage-invoices__leader-amount">
                      {formatFaNumber(row.amountIrt)}
                    </span>
                  </div>
                ))
              : payload!.topPanels.slice(0, 5).map((row, index) => (
                  <div
                    key={`${row.clientUsername}-${row.telegramUserId}`}
                    className="admin-usage-invoices__leader-row"
                  >
                    <span className="admin-usage-invoices__leader-rank">
                      {formatFaNumber(index + 1)}
                    </span>
                    <span className="admin-usage-invoices__leader-name">
                      <span className="admin-usage-invoices__panel-name">{row.clientUsername}</span>
                      <em>{panelServiceLabel(row.serviceType)}</em>
                    </span>
                    <span className="admin-usage-invoices__leader-amount">
                      {formatFaNumber(row.amountIrt)}
                    </span>
                  </div>
                ))}
          </div>
        </section>
      ) : null}

      <section
        className="admin-usage-invoices__panel shop-rise"
        style={{ '--rise-index': 4 } as CSSProperties}
      >
        <h2 className="admin-usage-invoices__panel-title">لیست فاکتورها</h2>

        {loading ? (
          <ul className="admin-usage-invoices__tx-list" aria-busy="true">
            {[1, 2, 3, 4, 5].map((index) => (
              <InvoiceSkeleton key={index} index={index} />
            ))}
          </ul>
        ) : !payload || payload.items.length === 0 ? (
          <EmptyState compact title="فاکتوری در این بازه نیست" />
        ) : (
          <>
            <ul className="admin-usage-invoices__tx-list">
              {payload.items.map((item, index) => {
                const parts = trafficLabel(item.trafficBytes)
                return (
                  <li key={`${item.source ?? 'panel'}-${item.id}`}>
                    <button
                      type="button"
                      className="admin-usage-invoices__tx shop-rise"
                      style={{ '--rise-index': Math.min(index + 1, 8) } as CSSProperties}
                      onClick={() => openInvoice(item)}
                    >
                      <div className="admin-usage-invoices__tx-start">
                        <span className="admin-usage-invoices__tx-icon" aria-hidden>
                          <SolarIcon icon="solar:chart-2-bold-duotone" width={16} height={16} />
                        </span>
                        <div className="admin-usage-invoices__tx-body">
                          <strong className="admin-usage-invoices__panel-name">
                            {item.clientUsername}
                          </strong>
                          <span>
                            {item.userDisplayName} · {parts.amount} {parts.unit} ·{' '}
                            {formatInvoiceDate(item.createdAt)}
                          </span>
                        </div>
                      </div>
                      <span className="admin-usage-invoices__tx-amount">
                        {formatFaNumber(item.amountIrt)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>

            {payload.pagination.hasMore ? (
              <button
                type="button"
                className="admin-usage-invoices__more"
                disabled={loadingMore}
                onClick={() => void load(range, true, payload.items.length)}
              >
                {loadingMore ? 'در حال بارگذاری…' : 'نمایش بیشتر'}
              </button>
            ) : null}
          </>
        )}
      </section>
    </div>
  )
}
