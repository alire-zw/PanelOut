import { useMemo, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import CashierIcon from '../components/icons/cashier-stroke-rounded'
import ChartRoseIcon from '../components/icons/chart-rose-stroke-rounded'
import CursorRectangleSelection01Icon from '../components/icons/cursor-rectangle-selection-01-stroke-rounded'
import DatabaseLightningIcon from '../components/icons/database-lightning-stroke-rounded'
import TestTubeIcon from '../components/icons/test-tube-stroke-rounded'
import UserGroup02Icon from '../components/icons/user-group-02-stroke-rounded'
import { SolarIcon } from '../components/SolarIcon'
import { useEnsureUser } from '../hooks/useEnsureUser'
import { useMyPanels } from '../hooks/useMyPanels'
import { useTelegram } from '../hooks/useTelegram'
import { balanceToToman } from '../lib/api'
import { formatFaTraffic } from '../lib/formatTraffic'
import type { PanelSubscription } from '../lib/panelApi'
import { isOutboundSubscription, isPanelSubscription } from '../lib/subscriptionFilters'
import '../styles/shop-rise.css'
import './Dashboard.css'

function formatFaNumber(value: number | null | undefined) {
  return Math.trunc(Number(value) || 0).toLocaleString('fa-IR')
}

function serviceLabel(panel: PanelSubscription) {
  if (panel.serviceType === 'panel_reseller' || panel.isReseller) return 'پنل ریسلری'
  if (panel.serviceType === 'panel_trial' || panel.isTrial) return 'پنل تست رایگان'
  return 'پنل مصرفی شخصی'
}

function statusLabel(status: string) {
  if (status === 'active') return 'فعال'
  if (status === 'suspended') return 'تعلیق'
  if (status === 'deactivated') return 'غیرفعال'
  if (status === 'expired') return 'منقضی'
  return 'در حال بررسی'
}

function statusTone(status: string) {
  if (status === 'active') return 'done'
  if (status === 'suspended') return 'pending'
  return 'failed'
}

function iconToneClass(panel: PanelSubscription) {
  if (panel.isTrial || panel.serviceType === 'panel_trial') return 'dash__order-icon--trial'
  return 'dash__order-icon--usage'
}

function PanelIcon({ panel }: { panel: PanelSubscription }) {
  if (panel.isTrial || panel.serviceType === 'panel_trial') {
    return <TestTubeIcon width={22} height={22} color="#fff" />
  }
  return <CashierIcon width={22} height={22} color="#fff" />
}

function barFillClass(percent: number) {
  if (percent >= 90) return 'dash__panel-bar-fill dash__panel-bar-fill--danger'
  if (percent >= 70) return 'dash__panel-bar-fill dash__panel-bar-fill--warn'
  return 'dash__panel-bar-fill'
}

export function DashboardPage() {
  const { user } = useEnsureUser()
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const { panels, loading: loadingPanels } = useMyPanels()

  const panelSubscriptions = useMemo(
    () => panels.filter(isPanelSubscription),
    [panels],
  )

  const outboundSubscriptions = useMemo(
    () => panels.filter(isOutboundSubscription),
    [panels],
  )

  const personalPanel = useMemo(
    () =>
      panelSubscriptions.find(
        (p) =>
          p.serviceType === 'panel_usage' ||
          p.serviceType === 'panel_trial' ||
          (p.isPersonal && !p.isReseller) ||
          (p.isTrial && !p.isReseller),
      ) ?? null,
    [panelSubscriptions],
  )

  const panelsCount = panelSubscriptions.length
  const outboundCount = outboundSubscriptions.length

  const wallet = user ? balanceToToman(user.balance) : null

  const go = (path: string, state?: { returnTo?: string }) => {
    haptic('light')
    navigate(path, state ? { state } : undefined)
  }

  const usedPercent = Math.max(0, Math.min(100, personalPanel?.usedPercent ?? 0))
  const usersLabel =
    personalPanel?.totalUsers == null
      ? '—'
      : personalPanel.live?.maxUsers != null
        ? `${formatFaNumber(personalPanel.totalUsers)} / ${formatFaNumber(personalPanel.live.maxUsers)} کاربر`
        : `${formatFaNumber(personalPanel.totalUsers)} کاربر`

  const isTrial = personalPanel?.serviceType === 'panel_trial' || personalPanel?.isTrial
  const isPrepaid = personalPanel?.capacityMode === 'prepaid'

  return (
    <div className="dash">
      <div className="dash__content">
        <section className="dash__section shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
          <h2 className="dash__section-title">وضعیت پنل شخصی شما</h2>
          {loadingPanels ? (
            <div
              className="dash__order-card dash__order-card--static dash__panel-card dash__panel-card--skeleton"
              aria-busy="true"
              aria-label="در حال بارگذاری اطلاعات پنل"
            >
              <div className="dash__order-main">
                <span
                  className="dash-skeleton-box"
                  style={{ width: 44, height: 44, borderRadius: 11, flexShrink: 0 }}
                />
                <div className="dash__order-copy">
                  <span
                    className="dash-skeleton-box"
                    style={{ width: 120, height: 14, borderRadius: 6 }}
                  />
                  <span
                    className="dash-skeleton-box"
                    style={{ width: 75, height: 11, borderRadius: 5, marginTop: 4 }}
                  />
                </div>
                <span
                  className="dash-skeleton-box"
                  style={{ width: 44, height: 22, borderRadius: 8, flexShrink: 0 }}
                />
              </div>
              <div className="dash__panel-stats">
                <span className="dash-skeleton-box" style={{ height: 40, borderRadius: 8 }} />
                <span className="dash-skeleton-box" style={{ height: 40, borderRadius: 8 }} />
                <span className="dash-skeleton-box" style={{ height: 40, borderRadius: 8 }} />
              </div>
              <div className="dash__panel-usage">
                <span className="dash-skeleton-box" style={{ height: 10, borderRadius: 6 }} />
                <span className="dash-skeleton-box" style={{ height: 5, borderRadius: 999 }} />
              </div>
              <div className="dash__order-foot">
                <span className="dash-skeleton-box" style={{ width: 120, height: 12, borderRadius: 6 }} />
                <span className="dash-skeleton-box" style={{ width: 72, height: 12, borderRadius: 6 }} />
              </div>
            </div>
          ) : personalPanel ? (
            <button
              type="button"
              className="dash__order-card dash__panel-card"
              onClick={() => go('/dashboard/panels')}
            >
              <div className="dash__order-main">
                <div className={`dash__order-icon ${iconToneClass(personalPanel)}`}>
                  <PanelIcon panel={personalPanel} />
                </div>
                <div className="dash__order-copy">
                  <strong className="dash__panel-name">
                    {personalPanel.clientUsername}
                  </strong>
                  <span className="dash__order-meta">{serviceLabel(personalPanel)}</span>
                </div>
                <div className="dash__order-side">
                  <span
                    className={`dash__badge dash__badge--${statusTone(personalPanel.status)}`}
                  >
                    {statusLabel(personalPanel.status)}
                  </span>
                </div>
              </div>

              <div className="dash__panel-stats">
                <div className="dash__panel-stat">
                  <UserGroup02Icon
                    width={36}
                    height={36}
                    className="dash__panel-stat-bg-icon"
                  />
                  <span className="dash__panel-stat-label">کاربران</span>
                  <strong className="dash__panel-stat-value">{usersLabel}</strong>
                </div>

                <div className="dash__panel-stat">
                  <ChartRoseIcon
                    width={36}
                    height={36}
                    className="dash__panel-stat-bg-icon"
                  />
                  <span className="dash__panel-stat-label">مصرف</span>
                  <strong className="dash__panel-stat-value">
                    {formatFaTraffic(personalPanel.usedTrafficGb)}
                  </strong>
                </div>

                <div className="dash__panel-stat">
                  <DatabaseLightningIcon
                    width={36}
                    height={36}
                    className="dash__panel-stat-bg-icon"
                  />
                  <span className="dash__panel-stat-label">
                    {isTrial || isPrepaid ? 'باقی‌مانده' : 'ظرفیت'}
                  </span>
                  <strong className="dash__panel-stat-value">
                    {formatFaTraffic(personalPanel.remainingTrafficGb)}
                  </strong>
                </div>
              </div>

              <div className="dash__panel-usage">
                <div className="dash__panel-usage-head">
                  <span className="dash__panel-usage-title">
                    {isTrial
                      ? 'مصرف حجم تست'
                      : isPrepaid
                        ? 'مصرف حجم پرداخت‌شده'
                        : 'درصد مصرف ظرفیت'}
                  </span>
                  <span className="dash__panel-usage-pct">
                    {formatFaNumber(usedPercent)}٪
                  </span>
                </div>
                <div className="dash__panel-bar" aria-hidden>
                  <div
                    className={barFillClass(usedPercent)}
                    style={{ width: `${usedPercent}%` }}
                  />
                </div>
              </div>

              <div className="dash__order-foot">
                <div className="dash__order-foot-start">
                  <span className="dash__order-pay">
                    {isTrial
                      ? 'حجم کل تست'
                      : isPrepaid
                        ? 'حجم پرداخت‌شده'
                        : 'موجودی کیف اصلی'}
                  </span>
                  <span className="dash__order-dot" aria-hidden />
                  <span className="dash__order-price">
                    {isTrial
                      ? `${formatFaNumber(personalPanel.trialVolumeGb ?? 5)} گیگ`
                      : isPrepaid
                        ? formatFaTraffic(personalPanel.prepaidTrafficGb)
                        : `${formatFaNumber(wallet ?? 0)} تومان`}
                  </span>
                </div>
                <span className="dash__panel-cta">
                  <span>مشاهده جزئیات</span>
                  <SolarIcon icon="solar:arrow-left-linear" width={14} height={14} />
                </span>
              </div>
            </button>
          ) : (
            <div className="dash__order-card dash__order-card--static dash__empty">
              <EmptyState compact title="هنوز پنل شخصی دریافت نکرده‌اید" />
            </div>
          )}
        </section>

        <section className="dash__section shop-rise" style={{ '--rise-index': 1 } as CSSProperties}>
          <h2 className="dash__section-title">پنل‌های من</h2>
          <button type="button" className="dash__order-card" onClick={() => go('/dashboard/panels')}>
            <div className="dash__order-main">
              <div
                className="dash__order-icon"
                style={{ background: 'linear-gradient(145deg, #38bdf8, #0369a1)' }}
              >
                <CursorRectangleSelection01Icon width={22} height={22} color="#fff" />
              </div>
              <div className="dash__order-copy">
                <strong className="dash__order-name">
                  پنل‌ها
                  {panelsCount > 0 ? ` (${formatFaNumber(panelsCount)})` : ''}
                </strong>
                <span className="dash__order-meta">
                  مشاهده پنل تست، مصرفی شخصی و ریسلری
                </span>
              </div>
              <div className="dash__order-side">
                <span className="dash__order-time">مشاهده</span>
              </div>
            </div>
          </button>
        </section>

        <section className="dash__section shop-rise" style={{ '--rise-index': 2 } as CSSProperties}>
          <h2 className="dash__section-title">اوتباند‌های من</h2>
          <button type="button" className="dash__order-card" onClick={() => go('/dashboard/outbound')}>
            <div className="dash__order-main">
              <div
                className="dash__order-icon"
                style={{ background: 'linear-gradient(145deg, #a78bfa, #6d28d9)' }}
              >
                <DatabaseLightningIcon width={22} height={22} color="#fff" />
              </div>
              <div className="dash__order-copy">
                <strong className="dash__order-name">
                  اوتباند
                  {outboundCount > 0 ? ` (${formatFaNumber(outboundCount)})` : ''}
                </strong>
                <span className="dash__order-meta">
                  مشاهده لینک اتصال و مدیریت سرویس‌های اوتباند
                </span>
              </div>
              <div className="dash__order-side">
                <span className="dash__order-time">مشاهده</span>
              </div>
            </div>
          </button>
        </section>
      </div>
    </div>
  )
}
