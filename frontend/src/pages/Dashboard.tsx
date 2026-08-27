import { type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import CursorRectangleSelection01Icon from '../components/icons/cursor-rectangle-selection-01-stroke-rounded'
import MoneyBagIcon from '../components/icons/MoneyBagIcon'
import PaymentHistoryIcon from '../components/icons/PaymentHistoryIcon'
import ServerStack02Icon from '../components/icons/server-stack-02-stroke-rounded'
import ShopIcon from '../components/icons/ShopIcon'
import { formatFaNumber, resellerPanels, type ResellerPanel } from '../data/resellerMock'
import { useEnsureUser } from '../hooks/useEnsureUser'
import { useTelegram } from '../hooks/useTelegram'
import { balanceToToman } from '../lib/api'
import '../styles/shop-rise.css'
import './Dashboard.css'

const PANEL_ICON_BG: Record<ResellerPanel['tone'], string> = {
  lime: 'linear-gradient(145deg, color-mix(in srgb, var(--accent) 72%, #84cc16), color-mix(in srgb, var(--accent) 40%, #365314))',
  sky: 'linear-gradient(145deg, #38bdf8, #0369a1)',
  amber: 'linear-gradient(145deg, #f59e0b, #b45309)',
  rose: 'linear-gradient(145deg, #fb7185, #be123c)',
  slate: 'linear-gradient(145deg, #94a3b8, #475569)',
}

function statusLabel(status: ResellerPanel['status']) {
  switch (status) {
    case 'online':
      return 'آنلاین'
    case 'degraded':
      return 'نوسان'
    default:
      return 'آفلاین'
  }
}

function statusTone(status: ResellerPanel['status']) {
  switch (status) {
    case 'online':
      return 'done'
    case 'degraded':
      return 'processing'
    default:
      return 'failed'
  }
}

function usageLabel(panel: ResellerPanel) {
  return `${formatFaNumber(Math.round(panel.usedGb))} از ${formatFaNumber(panel.quotaGb)} گیگ`
}

export function DashboardPage() {
  const { user } = useEnsureUser()
  const navigate = useNavigate()
  const { haptic } = useTelegram()

  const latestPanel = resellerPanels[0] ?? null
  const wallet = user ? balanceToToman(user.balance) : null

  const go = (path: string, state?: { returnTo?: string }) => {
    haptic('light')
    navigate(path, state ? { state } : undefined)
  }

  return (
    <div className="dash">
      <div className="dash__content">
        <section className="dash__section shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
          <h2 className="dash__section-title">وضعیت آخرین پنل شما</h2>
          {latestPanel ? (
            <button type="button" className="dash__order-card" onClick={() => go('/')}>
              <div className="dash__order-main">
                <div
                  className="dash__order-icon"
                  style={{ background: PANEL_ICON_BG[latestPanel.tone] }}
                >
                  <ServerStack02Icon width={22} height={22} color="#fff" />
                </div>
                <div className="dash__order-copy">
                  <strong className="dash__order-name">{latestPanel.name}</strong>
                  <span className="dash__order-meta">{usageLabel(latestPanel)}</span>
                </div>
                <div className="dash__order-side">
                  <span className={`dash__badge dash__badge--${statusTone(latestPanel.status)}`}>
                    {statusLabel(latestPanel.status)}
                  </span>
                  <span className="dash__order-time">{latestPanel.role}</span>
                </div>
              </div>
              <div className="dash__order-foot">
                <div className="dash__order-foot-start">
                  <span className="dash__order-pay">{formatFaNumber(latestPanel.activeUsers)} کاربر</span>
                  <span className="dash__order-dot" aria-hidden="true" />
                  <span className="dash__order-id" dir="ltr">
                    {latestPanel.host}
                  </span>
                </div>
                <span className="dash__order-price">
                  {formatFaNumber(latestPanel.pricePerGb)}
                  <span> ت / گیگ</span>
                </span>
              </div>
            </button>
          ) : (
            <div className="dash__order-card dash__order-card--static dash__empty">
              <EmptyState compact title="هنوز پنلی دریافت نکرده‌اید" />
            </div>
          )}
        </section>

        <section className="dash__section shop-rise" style={{ '--rise-index': 1 } as CSSProperties}>
          <h2 className="dash__section-title">پنل‌های من</h2>
          <button type="button" className="dash__order-card" onClick={() => go('/')}>
            <div className="dash__order-main">
              <div
                className="dash__order-icon"
                style={{ background: PANEL_ICON_BG.sky }}
              >
                <CursorRectangleSelection01Icon width={22} height={22} color="#fff" />
              </div>
              <div className="dash__order-copy">
                <strong className="dash__order-name">سرویس‌های پنل</strong>
                <span className="dash__order-meta">
                  {resellerPanels.length > 0
                    ? `${formatFaNumber(resellerPanels.length)} پنل فعال`
                    : 'هنوز پنلی فعال نشده'}
                </span>
              </div>
              <div className="dash__order-side">
                <span className="dash__order-time">مشاهده</span>
              </div>
            </div>
          </button>
        </section>

        <section className="dash__section shop-rise" style={{ '--rise-index': 2 } as CSSProperties}>
          <h2 className="dash__section-title">دکمه‌های اقدام سریع</h2>
          <div className="dash__actions">
            <button type="button" className="dash__action dash__action--primary" onClick={() => go('/')}>
              <ShopIcon width={18} height={18} />
              دریافت پنل جدید
            </button>
            <div className="dash__actions-row">
              <button
                type="button"
                className="dash__action"
                onClick={() => go('/profile/charge-history', { returnTo: '/dashboard' })}
              >
                <PaymentHistoryIcon width={18} height={18} />
                تاریخچه تراکنش
              </button>
              <button type="button" className="dash__action" onClick={() => go('/wallet')}>
                <MoneyBagIcon width={18} height={18} />
                کیف پول
              </button>
            </div>
          </div>
        </section>

        <section className="dash__section shop-rise" style={{ '--rise-index': 3 } as CSSProperties}>
          <h2 className="dash__section-title">کیف پول</h2>
          <div className="dash__wallet">
            <div className="dash__wallet-top">
              <div className="dash__wallet-icon">
                <MoneyBagIcon width={20} height={20} />
              </div>
              <div className="dash__wallet-copy">
                <h3 className="dash__wallet-title">موجودی کیف پول شما</h3>
                <p className="dash__wallet-desc">
                  برای دریافت پنل و افزایش ظرفیت، کیف پول را شارژ کنید.
                </p>
              </div>
            </div>
            <div className="dash__wallet-footer">
              <div className="dash__wallet-points">
                <strong>{wallet == null ? '—' : formatFaNumber(wallet)}</strong>
                <span>تومان</span>
              </div>
              <button type="button" className="dash__wallet-btn" onClick={() => go('/wallet')}>
                مشاهده کیف پول
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
