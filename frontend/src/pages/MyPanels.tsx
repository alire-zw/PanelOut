import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { Notification } from '../components/Notification'
import { PageHeader } from '../components/PageHeader'
import { PanelAllocateSheet } from '../components/PanelAllocateSheet'
import { PanelDetailSheet } from '../components/PanelDetailSheet'
import { SolarIcon } from '../components/SolarIcon'
import { HEADER_BOX_SIZE } from '../components/headerConstants'
import Agreement02Icon from '../components/icons/agreement-02-stroke-rounded'
import CashierIcon from '../components/icons/cashier-stroke-rounded'
import ClockIcon from '../components/icons/ClockIcon'
import MoneyBagIcon from '../components/icons/MoneyBagIcon'
import TestTubeIcon from '../components/icons/test-tube-stroke-rounded'
import UserIcon from '../components/icons/UserIcon'
import { useEnsureUser } from '../hooks/useEnsureUser'
import { useMyPanels } from '../hooks/useMyPanels'
import { useTelegram } from '../hooks/useTelegram'
import { balanceToToman } from '../lib/api'
import { formatAmountFa } from '../lib/amount'
import { formatFaTraffic } from '../lib/formatTraffic'
import {
  allocatePanelBalance,
  resetPanelPassword,
  togglePanelSubscription,
  type PanelSubscription,
} from '../lib/panelApi'
import { isPanelSubscription } from '../lib/subscriptionFilters'
import { isTelegramWebApp } from '../lib/telegram'
import '../styles/shop-rise.css'
import '../components/Header.css'
import './PanelFlow.css'
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
  if (panel.isReseller || panel.serviceType === 'panel_reseller') return 'ریسلری'
  if (panel.isTrial || panel.serviceType === 'panel_trial') return 'تست'
  return 'مصرفی شخصی'
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

function canToggleBilling(panel: PanelSubscription) {
  return (
    panel.serviceType === 'panel_usage' ||
    panel.serviceType === 'panel_reseller' ||
    panel.isReseller
  )
}

function PanelIcon({ panel }: { panel: PanelSubscription }) {
  if (panel.isReseller || panel.serviceType === 'panel_reseller') {
    return <Agreement02Icon width={20} height={20} color="#fff" />
  }
  if (panel.isTrial || panel.serviceType === 'panel_trial') {
    return <TestTubeIcon width={20} height={20} color="#fff" />
  }
  return <CashierIcon width={20} height={20} color="#fff" />
}

function iconToneClass(panel: PanelSubscription) {
  if (panel.isReseller || panel.serviceType === 'panel_reseller') return 'mypanel-card__icon--reseller'
  if (panel.isTrial || panel.serviceType === 'panel_trial') return 'mypanel-card__icon--trial'
  return 'mypanel-card__icon--usage'
}

function barFillClass(percent: number) {
  if (percent >= 90) return 'mypanel-card__bar-fill mypanel-card__bar-fill--danger'
  if (percent >= 70) return 'mypanel-card__bar-fill mypanel-card__bar-fill--warn'
  return 'mypanel-card__bar-fill'
}

export function MyPanelsPage() {
  const { user, refetch } = useEnsureUser()
  const { haptic } = useTelegram()
  const navigate = useNavigate()
  const {
    panels,
    userBalance,
    loading,
    error: loadError,
    reload,
    patchPanel,
    setUserBalanceLocal,
    refreshInBackground,
  } = useMyPanels()

  const panelItems = useMemo(
    () => panels.filter(isPanelSubscription),
    [panels],
  )

  const [retryLoading, setRetryLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [selectedPanelForDetails, setSelectedPanelForDetails] = useState<PanelSubscription | null>(null)
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false)
  const [selectedPanelForAllocate, setSelectedPanelForAllocate] = useState<PanelSubscription | null>(null)
  const [isAllocateSheetOpen, setIsAllocateSheetOpen] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({})
  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error'
  }>({ show: false, message: '', type: 'success' })

  const headerBalance = user ? balanceToToman(user.balance) : userBalance
  const isLoadingPanels = loading || retryLoading

  const toggleExpand = (id: string) => {
    haptic('light')
    setExpandedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
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

  const handleOpenAllocate = (panel: PanelSubscription) => {
    haptic('light')
    setSelectedPanelForAllocate(panel)
    setIsAllocateSheetOpen(true)
  }

  const handleConfirmAllocate = async (
    panel: PanelSubscription,
    amount: number,
    action: 'increase' | 'decrease',
  ) => {
    setBusyId(panel.id)
    try {
      const result = await allocatePanelBalance(panel.id, amount, action)
      haptic('light')
      setUserBalanceLocal(result.userBalance)
      patchPanel(panel.id, result.subscription)
      if (selectedPanelForDetails?.id === panel.id) {
        setSelectedPanelForDetails((prev) =>
          prev ? { ...prev, ...result.subscription } : null,
        )
      }
      setSelectedPanelForAllocate((prev) =>
        prev && prev.id === panel.id ? { ...prev, ...result.subscription } : prev,
      )
      setIsAllocateSheetOpen(false)
      setNotification({
        show: true,
        message:
          action === 'increase'
            ? `${formatAmountFa(String(amount))} تومان به کیف پول پنل افزوده شد`
            : `${formatAmountFa(String(amount))} تومان به کیف پول اصلی برگشت داده شد`,
        type: 'success',
      })
      void refetch({ silent: true })
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

  const handleToggle = async (panel: PanelSubscription, action: 'suspend' | 'reactivate') => {
    setBusyId(panel.id)
    try {
      const result = await togglePanelSubscription(panel.id, action)
      haptic('light')
      patchPanel(panel.id, { status: result.status })
      setNotification({
        show: true,
        message:
          action === 'suspend'
            ? 'کاربران پنل تعلیق شدند'
            : 'کاربران پنل دوباره فعال شدند',
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

  const handleResetPassword = async (panel: PanelSubscription) => {
    setBusyId(panel.id)
    try {
      const result = await resetPanelPassword(panel.id)
      haptic('light')
      patchPanel(panel.id, {
        adminPassword: result.password,
        hasPassword: true,
      })
      if (selectedPanelForDetails?.id === panel.id) {
        setSelectedPanelForDetails((prev) =>
          prev ? { ...prev, adminPassword: result.password, hasPassword: true } : null,
        )
      }
      setNotification({
        show: true,
        message: 'رمز عبور پنل با موفقیت تغییر کرد',
        type: 'success',
      })
    } catch (err) {
      setNotification({
        show: true,
        message: err instanceof Error ? err.message : 'تغییر رمز عبور ناموفق بود',
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
          title="پنل‌های من"
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
          <h2 className="dash__section-title">لیست پنل‌ها</h2>
          {isLoadingPanels ? (
            <div className="mypanels-list" aria-busy="true" aria-label="در حال بارگذاری پنل‌ها">
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
                    <span
                      className="mypanel-skeleton-box"
                      style={{ width: 62, height: 28, borderRadius: 10, flexShrink: 0 }}
                    />
                  </div>
                  <div className="mypanel-card__summary">
                    <span
                      className="mypanel-skeleton-box"
                      style={{ height: 36, borderRadius: 10 }}
                    />
                    <span
                      className="mypanel-skeleton-box"
                      style={{ height: 36, borderRadius: 10 }}
                    />
                    <span
                      className="mypanel-skeleton-box"
                      style={{ height: 36, borderRadius: 10 }}
                    />
                  </div>
                </article>
              ))}
            </div>
          ) : loadError ? (
            <div className="dash__order-card dash__order-card--static dash__empty">
              <EmptyState
                compact
                title="بارگذاری پنل‌ها ناموفق بود"
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
          ) : panelItems.length === 0 ? (
            <div className="dash__order-card dash__order-card--static dash__empty">
              <EmptyState compact title="هنوز پنلی ندارید" />
            </div>
          ) : (
            <div className="mypanels-list">
              {panelItems.map((panel) => {
                const isReseller = panel.serviceType === 'panel_reseller'
                const isTrial = panel.serviceType === 'panel_trial'
                const walletShown = isReseller
                  ? panel.walletBalance ?? 0
                  : panel.displayWalletBalance ?? userBalance
                const usedPercent = Math.max(0, Math.min(100, panel.usedPercent ?? 0))
                const isPrepaid = panel.capacityMode === 'prepaid'
                const isExpanded = Boolean(expandedIds[panel.id])
                const usersLabel =
                  panel.totalUsers == null
                    ? '—'
                    : panel.live?.maxUsers != null
                      ? `${formatFaNumber(panel.totalUsers)} / ${formatFaNumber(panel.live.maxUsers)}`
                      : formatFaNumber(panel.totalUsers)

                return (
                  <article
                    key={panel.id}
                    className={`mypanel-card${isExpanded ? ' mypanel-card--expanded' : ''}`}
                  >
                    <div
                      className="mypanel-card__top"
                      onClick={() => toggleExpand(panel.id)}
                    >
                      <div className={`mypanel-card__icon ${iconToneClass(panel)}`}>
                        <PanelIcon panel={panel} />
                      </div>
                      <div className="mypanel-card__head">
                        <strong className="mypanel-card__name">
                          {panel.clientUsername}
                        </strong>
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
                      <div
                        className="mypanel-card__summary"
                        onClick={() => toggleExpand(panel.id)}
                      >
                        <div className="mypanel-card__summary-chip">
                          <div className="mypanel-card__summary-chip-label">
                            <UserIcon width={13} height={13} color="currentColor" />
                            <span>کاربران</span>
                          </div>
                          <strong className="mypanel-card__summary-chip-value">
                            {usersLabel}
                          </strong>
                        </div>

                        <div className="mypanel-card__summary-chip">
                          <div className="mypanel-card__summary-chip-label">
                            <SolarIcon icon="solar:database-linear" width={13} height={13} />
                            <span>مصرف</span>
                          </div>
                          <strong className="mypanel-card__summary-chip-value">
                            {formatFaTraffic(panel.usedTrafficGb)}
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
                              <UserIcon width={12} height={12} color="currentColor" />
                              کاربران
                            </span>
                            <span className="mypanel-card__stat-value">{usersLabel}</span>
                          </div>
                          <div className="mypanel-card__stat">
                            <span className="mypanel-card__stat-label">
                              <MoneyBagIcon width={12} height={12} color="currentColor" />
                              {isReseller ? 'کیف پنل' : isTrial ? 'حجم تست' : 'کیف اصلی'}
                            </span>
                            <span className="mypanel-card__stat-value">
                              {isTrial
                                ? `${formatFaNumber(panel.trialVolumeGb ?? 5)} گیگ`
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
                              {isTrial
                                ? 'مصرف حجم تست'
                                : isPrepaid
                                  ? 'مصرف حجم پرداخت‌شده'
                                  : 'ظرفیت تقریبی بر اساس موجودی'}
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
                              {isTrial ? 'باقی‌مانده' : isPrepaid ? 'باقی‌مانده' : 'قابل‌مصرف'}:{' '}
                              <strong>{formatFaTraffic(panel.remainingTrafficGb)}</strong>
                            </span>
                          </div>
                        </div>

                        <div className="mypanel-card__actions">
                          <div className="mypanel-card__actions-row">
                            <button
                              type="button"
                              className="mypanel-card__btn mypanel-card__btn--ghost"
                              onClick={() => openCredentials(panel)}
                            >
                              مشخصات
                            </button>
                            <button
                              type="button"
                              className="mypanel-card__btn mypanel-card__btn--ghost"
                              disabled={busyId === panel.id}
                              onClick={() => void handleResetPassword(panel)}
                            >
                              {busyId === panel.id ? '…' : 'ریست پسورد'}
                            </button>
                            {canToggleBilling(panel) && panel.status === 'active' ? (
                              <button
                                type="button"
                                className="mypanel-card__btn mypanel-card__btn--ghost"
                                disabled={busyId === panel.id}
                                onClick={() => void handleToggle(panel, 'suspend')}
                              >
                                {busyId === panel.id ? '…' : 'تعلیق'}
                              </button>
                            ) : canToggleBilling(panel) && panel.status === 'suspended' ? (
                              <button
                                type="button"
                                className="mypanel-card__btn mypanel-card__btn--primary"
                                disabled={busyId === panel.id}
                                onClick={() => void handleToggle(panel, 'reactivate')}
                              >
                                {busyId === panel.id ? '…' : 'فعال‌سازی'}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="mypanel-card__btn mypanel-card__btn--primary"
                                onClick={() => {
                                  haptic('light')
                                  if (panel.panelUrl) window.open(panel.panelUrl, '_blank', 'noopener')
                                }}
                              >
                                ورود به پنل
                              </button>
                            )}
                          </div>

                          {isReseller ? (
                            <div className="mypanel-card__allocate">
                              <button
                                type="button"
                                className="mypanel-card__btn mypanel-card__btn--primary"
                                style={{ width: '100%' }}
                                onClick={() => handleOpenAllocate(panel)}
                              >
                                مدیریت موجودی کیف پنل (افزایش / کسر)
                              </button>
                            </div>
                          ) : null}
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
        onOpenAllocate={handleOpenAllocate}
        onCopySuccess={(msg) => {
          setNotification({
            show: true,
            message: msg,
            type: 'success',
          })
        }}
      />

      <PanelAllocateSheet
        isOpen={isAllocateSheetOpen}
        panel={selectedPanelForAllocate}
        userBalance={headerBalance}
        isBusy={busyId === selectedPanelForAllocate?.id}
        onClose={() => {
          setIsAllocateSheetOpen(false)
          setSelectedPanelForAllocate(null)
        }}
        onConfirm={handleConfirmAllocate}
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
