import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import ComplaintIcon from '../components/icons/complaint-stroke-rounded'
import Ticket02Icon from '../components/icons/ticket-02-stroke-rounded'
import { EmptyState } from '../components/EmptyState'
import { useTelegram } from '../hooks/useTelegram'
import { isTelegramWebApp } from '../lib/api'
import {
  fetchSupportContact,
  fetchSupportTickets,
  readLocalSupportContact,
  readLocalSupportTickets,
  supportStatusLabel,
  supportTicketTitle,
  syncSupportTickets,
  writeLocalSupportContact,
  writeLocalSupportTickets,
  type SupportTicketSummary,
  type SupportTicketsPayload,
} from '../lib/supportApi'
import '../styles/shop-rise.css'
import './Support.css'

function ArrowIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="none" viewBox="0 0 24 24">
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="m15 18-6-6 6-6"
      />
    </svg>
  )
}

function formatFaDate(value: string): string {
  return new Date(value).toLocaleDateString('fa-IR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function TicketSkeleton({ index }: { index: number }) {
  return (
    <div
      className="support__ticket-card support__ticket-card--skeleton shop-rise"
      style={{ '--rise-index': 4 + index } as CSSProperties}
    >
      <span className="support__ticket-skel-icon" />
      <span className="support__ticket-card-body">
        <span className="support__ticket-card-top">
          <span className="support__ticket-skel-title" />
          <span className="support__ticket-skel-badge" />
        </span>
        <span className="support__ticket-skel-meta" />
      </span>
    </div>
  )
}

export function SupportPage() {
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const localTickets = readLocalSupportTickets()
  const localContact = readLocalSupportContact()
  const [items, setItems] = useState<SupportTicketSummary[]>(() => localTickets?.items ?? [])
  const [hasFetched, setHasFetched] = useState(() => Boolean(localTickets))
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [telegramUsername, setTelegramUsername] = useState<string | null>(
    () => localContact?.telegramUsername ?? null,
  )
  const [telegramUrl, setTelegramUrl] = useState<string | null>(
    () => localContact?.telegramUrl ?? null,
  )

  const applyTicketsPayload = useCallback((payload: SupportTicketsPayload) => {
    setItems(payload.items)
    setError(null)
    writeLocalSupportTickets(payload)
  }, [])

  const refreshTicketsInBackground = useCallback(
    async (version?: string | null) => {
      setIsRefreshing(true)
      try {
        const syncResult = await syncSupportTickets(version ?? undefined)
        if (syncResult.changed) {
          applyTicketsPayload(syncResult)
        }
      } catch {
        // background sync must not block UI
      } finally {
        setIsRefreshing(false)
      }
    },
    [applyTicketsPayload],
  )

  const loadTickets = useCallback(async () => {
    const localCache = readLocalSupportTickets()
    if (localCache) {
      applyTicketsPayload(localCache)
      setHasFetched(true)
      void refreshTicketsInBackground(localCache.version)
      return
    }

    setError(null)
    try {
      const payload = await fetchSupportTickets()
      applyTicketsPayload(payload)
      void refreshTicketsInBackground(payload.version)
    } catch (err) {
      setItems([])
      setError(err instanceof Error ? err.message : 'خطا در دریافت تیکت‌ها')
    } finally {
      setHasFetched(true)
    }
  }, [applyTicketsPayload, refreshTicketsInBackground])

  const loadContact = useCallback(async () => {
    const local = readLocalSupportContact()
    if (local) {
      setTelegramUsername(local.telegramUsername)
      setTelegramUrl(local.telegramUrl)
    }
    try {
      const contact = await fetchSupportContact()
      setTelegramUsername(contact.telegramUsername)
      setTelegramUrl(contact.telegramUrl)
      writeLocalSupportContact(contact)
    } catch {
      // keep local contact if any
    }
  }, [])

  useEffect(() => {
    void loadTickets()
    void loadContact()
  }, [loadContact, loadTickets])

  const openDirectChat = () => {
    if (!telegramUrl) return
    haptic('medium')
    if (isTelegramWebApp() && window.Telegram?.WebApp.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(telegramUrl)
      return
    }
    window.open(telegramUrl, '_blank', 'noopener,noreferrer')
  }

  const handleMenuClick = (action: () => void) => {
    haptic('light')
    action()
  }

  const openCount = items.filter((item) => item.status === 'open').length
  const answeredCount = items.filter((item) => item.status === 'answered').length
  const showSkeleton = !hasFetched && items.length === 0 && !error
  const showStatsSkeleton = !hasFetched && items.length === 0

  return (
    <div className="support">
      <section className="support__hero shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <div className="support__hero-copy">
          <p className="support__eyebrow">مرکز پشتیبانی</p>
          <h1 className="support__title">چطور کمکت کنیم؟</h1>
          <p className="support__lead">
            تیکت ثبت کن تا پیگیری سفارش و مشکلاتت با شناسه رسمی انجام بشه، یا مستقیم با کارشناس در
            تلگرام حرف بزن.
          </p>
        </div>
        <div className="support__stats">
          <div className="support__stat">
            <span className="support__stat-value">
              {showStatsSkeleton ? (
                <span className="support__stat-skel" />
              ) : (
                items.length.toLocaleString('fa-IR')
              )}
            </span>
            <span className="support__stat-label">تیکت</span>
          </div>
          <div className="support__stat">
            <span className="support__stat-value">
              {showStatsSkeleton ? (
                <span className="support__stat-skel" />
              ) : (
                openCount.toLocaleString('fa-IR')
              )}
            </span>
            <span className="support__stat-label">باز</span>
          </div>
          <div className="support__stat">
            <span className="support__stat-value">
              {showStatsSkeleton ? (
                <span className="support__stat-skel" />
              ) : (
                answeredCount.toLocaleString('fa-IR')
              )}
            </span>
            <span className="support__stat-label">پاسخ‌خورده</span>
          </div>
        </div>
      </section>

      <h5 className="support__menu-title shop-rise" style={{ '--rise-index': 1 } as CSSProperties}>
        ارتباط سریع
      </h5>
      <div className="support__menu-box shop-rise" style={{ '--rise-index': 2 } as CSSProperties}>
        <button
          type="button"
          className="support__menu-item"
          onClick={() => handleMenuClick(() => navigate('/support/new'))}
        >
          <span className="support__menu-start">
            <span className="support__menu-icon">
              <Ticket02Icon width={18} height={18} />
            </span>
            <span>ثبت تیکت جدید</span>
          </span>
          <ArrowIcon />
        </button>
        <div className="support__menu-divider" />
        <button
          type="button"
          className={`support__menu-item${telegramUsername ? '' : ' support__menu-item--disabled'}`}
          disabled={!telegramUsername}
          onClick={openDirectChat}
        >
          <span className="support__menu-start">
            <span className="support__menu-icon">
              <ComplaintIcon width={18} height={18} />
            </span>
            <span>گفتگوی مستقیم با کارشناس در تلگرام</span>
          </span>
          <ArrowIcon />
        </button>
      </div>

      <h5 className="support__menu-title shop-rise" style={{ '--rise-index': 3 } as CSSProperties}>
        تیکت‌های من
        {isRefreshing ? (
          <span className="support__section-sync" aria-label="در حال بروزرسانی" />
        ) : null}
      </h5>

      {error && <p className="support__error">{error}</p>}

      {showSkeleton ? (
        <div className="support__ticket-panel shop-rise" style={{ '--rise-index': 4 } as CSSProperties}>
          {[0, 1, 2].map((index) => (
            <TicketSkeleton key={index} index={index} />
          ))}
        </div>
      ) : hasFetched && items.length === 0 ? (
        <div className="support__ticket-panel shop-rise" style={{ '--rise-index': 4 } as CSSProperties}>
          <EmptyState title="هنوز تیکتی ثبت نکرده‌اید" />
        </div>
      ) : (
        <div className="support__ticket-panel shop-rise" style={{ '--rise-index': 4 } as CSSProperties}>
          {items.map((ticket) => (
            <button
              key={ticket.id}
              type="button"
              className="support__ticket-card"
              onClick={() => handleMenuClick(() => navigate(`/support/${ticket.ticketCode}`))}
            >
              <span className="support__ticket-card-icon">
                <Ticket02Icon width={16} height={16} />
              </span>
              <span className="support__ticket-card-body">
                <span className="support__ticket-card-top">
                  <span className="support__ticket-card-title">
                    {supportTicketTitle(ticket.ticketCode)}
                  </span>
                  <span
                    className={`support__badge${
                      ticket.status === 'answered'
                        ? ' support__badge--answered'
                        : ticket.status === 'closed'
                          ? ' support__badge--closed'
                          : ''
                    }`}
                  >
                    {supportStatusLabel(ticket.status)}
                  </span>
                </span>
                <span className="support__ticket-card-meta">
                  {ticket.categoryLabel}
                  {' · '}
                  {formatFaDate(ticket.updatedAt)}
                </span>
              </span>
              <span className="support__ticket-card-arrow">
                <ArrowIcon />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
