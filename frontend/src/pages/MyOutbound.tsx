import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { Notification } from '../components/Notification'
import { PageHeader } from '../components/PageHeader'
import { PanelDetailSheet } from '../components/PanelDetailSheet'
import { SolarIcon } from '../components/SolarIcon'
import { HEADER_BOX_SIZE } from '../components/headerConstants'
import ChartRoseIcon from '../components/icons/chart-rose-stroke-rounded'
import ClockIcon from '../components/icons/ClockIcon'
import DatabaseLightningIcon from '../components/icons/database-lightning-stroke-rounded'
import MoneyBagIcon from '../components/icons/MoneyBagIcon'
import { useEnsureUser } from '../hooks/useEnsureUser'
import { useMyPanels } from '../hooks/useMyPanels'
import { useTelegram } from '../hooks/useTelegram'
import { balanceToToman } from '../lib/api'
import { formatFaTraffic } from '../lib/formatTraffic'
import {
  deactivateOutboundUsage,
  toggleOutboundVolume,
} from '../lib/outboundApi'
import type { PanelSubscription } from '../lib/panelApi'
import { isOutboundSubscription } from '../lib/subscriptionFilters'
import { isTelegramWebApp } from '../lib/telegram'
import '../styles/shop-rise.css'
import '../components/Header.css'
import './Dashboard.css'
import './MyPanels.css'

function formatFaNumber(value: number) {
  return Math.trunc(Number(value) || 0).toLocaleString('fa-IR')
}

function formatFaDateShort(iso: string | null | undefined) {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('fa-IR', {
    month: 'short',
    day: 'numeric',
  })
}

function serviceLabel(panel: PanelSubscription) {
  if (panel.isOutboundVolume || panel.serviceType === 'outbound_volume') return 'اوتباند حجمی'
  return 'اوتباند مصرفی'
}

function statusLabel(status: string) {
  if (status === 'suspended') return 'تعلیق'
  if (status === 'deactivated') return 'غیرفعال'
  if (status === 'expired') return 'منقضی'
  return 'فعال'
}

function statusTone(status: string) {
  if (status === 'suspended') return 'pending'
  if (status === 'deactivated' || status === 'expired') return 'failed'
  return 'done'
}

function isOutboundVolume(panel: PanelSubscription) {
  return panel.isOutboundVolume || panel.serviceType === 'outbound_volume'
}

function isOutboundUsage(panel: PanelSubscription) {
  return panel.isOutboundUsage || panel.serviceType === 'outbound_usage'
}

function OutboundIcon({ panel }: { panel: PanelSubscription }) {
  if (isOutboundVolume(panel)) {
    return <DatabaseLightningIcon width={20} height={20} color="#fff" />
  }
  return <ChartRoseIcon width={20} height={20} color="#fff" />
}

function iconToneClass(panel: PanelSubscription) {
  if (isOutboundVolume(panel)) return 'mypanel-card__icon--outbound-volume'
  return 'mypanel-card__icon--outbound-usage'
}

function barFillClass(percent: number) {
  if (percent >= 90) return 'mypanel-card__bar-fill mypanel-card__bar-fill--danger'
  if (percent >= 70) return 'mypanel-card__bar-fill mypanel-card__bar-fill--warn'
  return 'mypanel-card__bar-fill'
}

export function MyOutboundPage() {
  const { user } = useEnsureUser()
  const { haptic } = useTelegram()
  const navigate = useNavigate()
  const {
    panels,
    userBalance,
    loading,
    error: loadError,
    reload,
    patchPanel,
    refreshInBackground,
  } = useMyPanels()

  const outboundItems = useMemo(
    () => panels.filter(isOutboundSubscription),
    [panels],
  )

  const [retryLoading, setRetryLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [selectedPanelForDetails, setSelectedPanelForDetails] = useState<PanelSubscription | null>(null)
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({})
  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error'
  }>({ show: false, message: '', type: 'success' })

  const headerBalance = user ? balanceToToman(user.balance) : userBalance
  const isLoading = loading || retryLoading

  const toggleExpand = (id: string) => {
    haptic('light')
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleBack = useCallback(() => {
    navigate('/dashboard', { replace: true })
  }, [navigate])

  const handleWalletClick = useCallback(() => {
    haptic('light')
    navigate('/wallet')
  }, [haptic, navigate])

  useEffect(() => {
    if (!isTelegramWebApp()) return
    const backButton = window.Telegram?.WebApp.BackButton
    if (!backButton) return
    backButton.show()
    backButton.onClick(handleBack)
    return () => {
      backButton.hide()
      backButton.offClick(handleBack)
    }
  }, [handleBack])

  const openCredentials = (panel: PanelSubscription) => {
    haptic('light')
    setSelectedPanelForDetails(panel)
    setIsDetailSheetOpen(true)
  }

  const handleToggleVolume = async (panel: PanelSubscription) => {
    setBusyId(panel.id)
    try {
      const result = await toggleOutboundVolume(panel.id)
      haptic('light')
      patchPanel(panel.id, { status: result.subscription.status })
      setNotification({
        show: true,
        message:
          result.subscription.status === 'suspended'
            ? 'اوتباند حجمی تعلیق شد'
            : 'اوتباند حجمی فعال شد',
        type: 'success',
      })
      void refreshInBackground()
    } catch (err) {
      setNotification({
        show: true,
        message: err instanceof Error ? err.message : 'عملیات ناموفق بود',
        type: 'error',
      })
    } finally {
      setBusyId(null)
    }
  }

  const handleDeactivateUsage = async (panel: PanelSubscription) => {
    setBusyId(panel.id)
    try {
      const result = await deactivateOutboundUsage(panel.id)
      haptic('light')
      patchPanel(panel.id, { status: result.subscription.status })
      setIsDetailSheetOpen(false)
      setNotification({
        show: true,
        message: 'اوتباند مصرفی غیرفعال شد',
        type: 'success',
      })
      void refreshInBackground()
    } catch (err) {
      setNotification({
        show: true,
        message: err instanceof Error ? err.message : 'عملیات ناموفق بود',
        type: 'error',
      })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="dash mypanels-page">
      <div className="mypanels-page__top">
        <PageHeader
          title="اوتباند‌های من"
          onBack={handleBack}
          action={
            <button
              type="button"
              onClick={handleWalletClick}
              className={`app-header__wallet${
                headerBalance === 0 ? ' app-header__wallet--empty' : ''
              }`}
              style={{ height: HEADER_BOX_SIZE }}
              aria-label="موجودی"
            >
              <MoneyBagIcon
                width={16}
                height={16}
                color={headerBalance === 0 ? 'var(--accent-contrast)' : 'var(--accent)'}
              />
              {headerBalance > 0 ? (
                <span className="app-header__wallet-balance">
                  <span className="app-header__wallet-amount">
                    {headerBalance.toLocaleString('fa-IR')}
                  </span>
                  <span className="app-header__wallet-unit">تومان</span>
                </span>
              ) : (
                <span className="app-header__wallet-text">شارژ کیف پول</span>
              )}
            </button>
          }
        />
      </div>

      <div className="dash__content">
        <section className="dash__section shop-rise" style={{ '--rise-index': 1 } as CSSProperties}>
          <h2 className="dash__section-title">لیست اوتباند</h2>
          {isLoading ? (
            <div className="mypanels-list" aria-busy="true" aria-label="در حال بارگذاری">
              {[1, 2].map((idx) => (
                <article key={idx} className="mypanel-card mypanel-card--skeleton">
                  <div className="mypanel-card__top">
                    <span
                      className="mypanel-skeleton-box"
                      style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0 }}
                    />
                    <div className="mypanel-card__head">
                      <span
                        className="mypanel-skeleton-box"
                        style={{ width: 110, height: 14, borderRadius: 6 }}
                      />
                      <span
                        className="mypanel-skeleton-box"
                        style={{ width: 75, height: 11, borderRadius: 5, marginTop: 4 }}
                      />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : loadError ? (
            <div className="dash__order-card dash__order-card--static dash__empty">
              <EmptyState
                compact
                title="بارگذاری ناموفق بود"
                description={loadError}
                action={
                  <button
                    type="button"
                    className="faq-empty__reset"
                    onClick={() => {
                      setRetryLoading(true)
                      void reload().finally(() => setRetryLoading(false))
                    }}
                  >
                    تلاش مجدد
                  </button>
                }
              />
            </div>
          ) : outboundItems.length === 0 ? (
            <div className="dash__order-card dash__order-card--static dash__empty">
              <EmptyState compact title="هنوز اوتباندی ندارید" />
            </div>
          ) : (
            <div className="mypanels-list">
              {outboundItems.map((panel) => {
                const volume = isOutboundVolume(panel)
                const usage = isOutboundUsage(panel)
                const walletShown = panel.displayWalletBalance ?? userBalance
                const usedPercent = Math.max(0, Math.min(100, panel.usedPercent ?? 0))
                const isExpanded = Boolean(expandedIds[panel.id])

                return (
                  <article
                    key={panel.id}
                    className={`mypanel-card${isExpanded ? ' mypanel-card--expanded' : ''}`}
                  >
                    <div className="mypanel-card__top" onClick={() => toggleExpand(panel.id)}>
                      <div className={`mypanel-card__icon ${iconToneClass(panel)}`}>
                        <OutboundIcon panel={panel} />
                      </div>
                      <div className="mypanel-card__head">
                        <strong className="mypanel-card__name">{panel.clientUsername}</strong>
                        <div className="mypanel-card__meta">
                          <span className="mypanel-card__type">{serviceLabel(panel)}</span>
                          <span
                            className={`mypanel-card__badge mypanel-card__badge--${statusTone(panel.status)}`}
                          >
                            {statusLabel(panel.status)}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="mypanel-card__toggle"
                        aria-expanded={isExpanded}
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleExpand(panel.id)
                        }}
                      >
                        <span>{isExpanded ? 'بستن' : 'جزئیات'}</span>
                        <svg
                          className={`mypanel-card__toggle-chevron${
                            isExpanded ? ' mypanel-card__toggle-chevron--open' : ''
                          }`}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                    </div>

                    {!isExpanded ? (
                      <div className="mypanel-card__summary" onClick={() => toggleExpand(panel.id)}>
                        <div className="mypanel-card__summary-chip">
                          <div className="mypanel-card__summary-chip-label">
                            <SolarIcon icon="solar:database-linear" width={13} height={13} />
                            <span>مصرف</span>
                          </div>
                          <strong className="mypanel-card__summary-chip-value">
                            {formatFaTraffic(panel.usedTrafficGb)}
                          </strong>
                        </div>

                        <div className="mypanel-card__summary-chip">
                          <div className="mypanel-card__summary-chip-label">
                            <SolarIcon icon="solar:server-linear" width={13} height={13} />
                            <span>{volume ? 'باقی‌مانده' : 'موجودی'}</span>
                          </div>
                          <strong className="mypanel-card__summary-chip-value">
                            {volume
                              ? formatFaTraffic(panel.remainingTrafficGb)
                              : `${formatFaNumber(walletShown)} ت`}
                          </strong>
                        </div>

                        <div
                          className={`mypanel-card__summary-chip mypanel-card__summary-chip--pct${
                            usedPercent >= 90
                              ? ' mypanel-card__summary-chip--danger'
                              : usedPercent >= 70
                                ? ' mypanel-card__summary-chip--warn'
                                : ''
                          }`}
                        >
                          <div className="mypanel-card__summary-chip-label">
                            <SolarIcon icon="solar:chart-2-linear" width={13} height={13} />
                            <span>درصد</span>
                          </div>
                          <strong className="mypanel-card__summary-chip-value">
                            {formatFaNumber(usedPercent)}٪
                          </strong>
                        </div>
                      </div>
                    ) : null}

                    <div
                      className={`mypanel-card__expandable${
                        isExpanded ? ' mypanel-card__expandable--open' : ''
                      }`}
                    >
                      <div className="mypanel-card__expandable-inner">
                        <div className="mypanel-card__stats">
                          <div className="mypanel-card__stat">
                            <span className="mypanel-card__stat-label">
                              <SolarIcon icon="solar:database-linear" width={12} height={12} />
                              مصرف
                            </span>
                            <span className="mypanel-card__stat-value">
                              {formatFaTraffic(panel.usedTrafficGb)}
                            </span>
                          </div>
                          <div className="mypanel-card__stat">
                            <span className="mypanel-card__stat-label">
                              <MoneyBagIcon width={12} height={12} color="currentColor" />
                              {volume ? 'حجم باقی‌مانده' : 'موجودی کیف'}
                            </span>
                            <span className="mypanel-card__stat-value">
                              {volume
                                ? formatFaTraffic(panel.remainingTrafficGb)
                                : `${formatFaNumber(walletShown)} ت`}
                            </span>
                          </div>
                          <div className="mypanel-card__stat">
                            <span className="mypanel-card__stat-label">
                              <ClockIcon width={12} height={12} color="currentColor" />
                              فعال‌سازی
                            </span>
                            <span className="mypanel-card__stat-value">
                              {formatFaDateShort(panel.createdAt)}
                            </span>
                          </div>
                        </div>

                        <div className="mypanel-card__usage">
                          <div className="mypanel-card__usage-head">
                            <span className="mypanel-card__usage-title">
                              {volume ? 'مصرف حجم خریداری‌شده' : 'مصرف بر اساس موجودی کیف'}
                            </span>
                            <span className="mypanel-card__usage-pct">
                              {formatFaNumber(usedPercent)}٪
                            </span>
                          </div>
                          <div className="mypanel-card__bar" aria-hidden>
                            <div
                              className={barFillClass(usedPercent)}
                              style={{ width: `${usedPercent}%` }}
                            />
                          </div>
                          <div className="mypanel-card__usage-foot">
                            <span>
                              مصرف‌شده:{' '}
                              <strong>{formatFaTraffic(panel.usedTrafficGb)}</strong>
                            </span>
                            <span>
                              {volume ? 'باقی‌مانده' : 'قابل‌مصرف'}:{' '}
                              <strong>
                                {volume
                                  ? formatFaTraffic(panel.remainingTrafficGb)
                                  : formatFaTraffic(panel.remainingTrafficGb)}
                              </strong>
                            </span>
                          </div>
                        </div>

                        <div className="mypanel-card__actions">
                          <div
                            className={`mypanel-card__actions-row${
                              (usage && panel.status !== 'deactivated') ||
                              (volume && (panel.status === 'active' || panel.status === 'suspended'))
                                ? ' mypanel-card__actions-row--duo'
                                : ' mypanel-card__actions-row--single'
                            }`}
                          >
                            <button
                              type="button"
                              className="mypanel-card__btn mypanel-card__btn--ghost"
                              onClick={() => openCredentials(panel)}
                            >
                              مشخصات
                            </button>
                            {usage && panel.status !== 'deactivated' ? (
                              <button
                                type="button"
                                className="mypanel-card__btn mypanel-card__btn--ghost"
                                disabled={busyId === panel.id}
                                onClick={() => void handleDeactivateUsage(panel)}
                              >
                                {busyId === panel.id ? '…' : 'غیرفعال‌سازی'}
                              </button>
                            ) : null}
                            {volume && panel.status === 'active' ? (
                              <button
                                type="button"
                                className="mypanel-card__btn mypanel-card__btn--ghost"
                                disabled={busyId === panel.id}
                                onClick={() => void handleToggleVolume(panel)}
                              >
                                {busyId === panel.id ? '…' : 'تعلیق'}
                              </button>
                            ) : volume && panel.status === 'suspended' ? (
                              <button
                                type="button"
                                className="mypanel-card__btn mypanel-card__btn--primary"
                                disabled={busyId === panel.id}
                                onClick={() => void handleToggleVolume(panel)}
                              >
                                {busyId === panel.id ? '…' : 'فعال‌سازی'}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </div>

      <PanelDetailSheet
        isOpen={isDetailSheetOpen}
        panel={selectedPanelForDetails}
        onClose={() => {
          setIsDetailSheetOpen(false)
          setSelectedPanelForDetails(null)
        }}
        onDeactivateOutbound={(panel) => void handleDeactivateUsage(panel)}
        onCopySuccess={(msg) => {
          setNotification({ show: true, message: msg, type: 'success' })
        }}
      />

      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification((prev) => ({ ...prev, show: false }))}
      />
    </div>
  )
}
