import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { ImageViewer } from '../components/ImageViewer'
import { Notification } from '../components/Notification'
import { PageHeader } from '../components/PageHeader'
import { SolarIcon } from '../components/SolarIcon'
import { useAdminAccess } from '../hooks/useAdminAccess'
import { useTelegram } from '../hooks/useTelegram'
import {
  fetchAdminTicket,
  fetchAdminTickets,
  replyAdminTicket,
  type AdminTicketListItem,
} from '../lib/adminSupportApi'
import { lockAppScroll, unlockAppScroll } from '../lib/scrollLock'
import { isTelegramWebApp } from '../lib/telegram'
import {
  displayUsername,
  formatFaNumber,
  ticketStatusLabel,
} from './adminLabels'
import '../styles/shop-rise.css'
import './Admin.css'
import './AdminTickets.css'

const STATUS_TABS = [
  { id: 'all', label: 'همه', icon: 'solar:bill-list-bold-duotone' as const },
  { id: 'open', label: 'باز', icon: 'solar:alarm-bold-duotone' as const },
  { id: 'answered', label: 'پاسخ‌خورده', icon: 'solar:chat-round-check-bold-duotone' as const },
  { id: 'closed', label: 'بسته', icon: 'solar:bill-cross-bold-duotone' as const },
]

const CATEGORY_CHIPS = [
  { value: 'all', label: 'همه' },
  { value: 'sales', label: 'فروش' },
  { value: 'product', label: 'محصول' },
  { value: 'wallet', label: 'کیف پول' },
  { value: 'other', label: 'سایر' },
]

function formatFaDateTime(value: string) {
  return new Date(value).toLocaleString('fa-IR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatFaTime(value: string) {
  return new Date(value).toLocaleTimeString('fa-IR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function TicketItemSkeleton({ index }: { index: number }) {
  return (
    <article
      className="admin-ticket-item admin-ticket-item--skeleton shop-rise"
      style={{ '--rise-index': Math.min(index + 2, 8) } as CSSProperties}
      aria-hidden
    >
      <div className="admin-ticket-item__header">
        <span className="admin-ticket-skel admin-ticket-skel--icon" />
        <div className="admin-ticket-item__summary">
          <div className="admin-ticket-item__title-row">
            <span className="admin-ticket-skel admin-ticket-skel--title" />
            <span className="admin-ticket-skel admin-ticket-skel--badge" />
          </div>
          <span className="admin-ticket-skel admin-ticket-skel--preview" />
        </div>
      </div>
      <div className="admin-ticket-item__meta">
        <span className="admin-ticket-item__meta-chip admin-ticket-item__meta-chip--skel">
          <span className="admin-ticket-skel admin-ticket-skel--line" />
        </span>
        <span className="admin-ticket-item__meta-chip admin-ticket-item__meta-chip--skel">
          <span className="admin-ticket-skel admin-ticket-skel--line admin-ticket-skel--line-sm" />
        </span>
      </div>
    </article>
  )
}

type TicketDetail = {
  ticketCode: string
  subject: string
  status: string
  categoryLabel?: string
  orderId?: string | null
  userLabel?: string
  messages: Array<{
    id: number
    senderRole: string
    body: string
    imageData?: string | null
    createdAt: string
  }>
}

export function AdminTicketsPage() {
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const { ready, allowed } = useAdminAccess()
  const [status, setStatus] = useState('all')
  const [category, setCategory] = useState('all')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<AdminTicketListItem[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<TicketDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [panelVisible, setPanelVisible] = useState(false)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [viewerSrc, setViewerSrc] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  }>({ show: false, message: '', type: 'error' })

  const showNotification = (
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'success',
  ) => setNotification({ show: true, message, type })

  const closePanel = useCallback(() => {
    setPanelVisible(false)
    window.setTimeout(() => {
      setSelectedId(null)
      setDetail(null)
      setReply('')
    }, 280)
  }, [])

  const handleBack = useCallback(() => {
    if (selectedId != null) {
      closePanel()
      return
    }
    navigate('/admin', { replace: true })
  }, [closePanel, navigate, selectedId])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetchAdminTickets({
        page,
        limit: 20,
        status: status === 'all' ? undefined : status,
        category: category === 'all' ? undefined : category,
      })
      setItems(result.items)
      setTotalPages(result.totalPages)
    } catch (error) {
      showNotification(error instanceof Error ? error.message : 'خطا در دریافت تیکت‌ها', 'error')
    } finally {
      setLoading(false)
    }
  }, [category, page, status])

  useEffect(() => {
    if (!ready || !allowed) return
    void load()
  }, [allowed, load, ready])

  useEffect(() => {
    setPage(1)
  }, [status, category])

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

  useEffect(() => {
    if (selectedId == null) {
      unlockAppScroll()
      return
    }
    lockAppScroll()
    const frame = window.requestAnimationFrame(() => setPanelVisible(true))
    return () => {
      window.cancelAnimationFrame(frame)
      unlockAppScroll()
    }
  }, [selectedId])

  useEffect(() => {
    if (!panelVisible) return
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [detail?.messages.length, panelVisible])

  const loadDetail = async (id: number, opts?: { reset?: boolean }) => {
    if (opts?.reset) {
      setDetail(null)
      setReply('')
    }
    setDetailLoading(true)
    try {
      const result = await fetchAdminTicket(id)
      setDetail({
        ticketCode: result.ticket.ticketCode,
        subject: result.ticket.subject,
        status: result.ticket.status,
        categoryLabel: result.ticket.categoryLabel,
        orderId: result.ticket.orderId,
        userLabel: displayUsername(result.ticket.user),
        messages: result.ticket.messages,
      })
      return true
    } catch (error) {
      showNotification(error instanceof Error ? error.message : 'خطا در دریافت تیکت', 'error')
      return false
    } finally {
      setDetailLoading(false)
    }
  }

  const openTicket = async (id: number) => {
    haptic('light')
    setSelectedId(id)
    const ok = await loadDetail(id, { reset: true })
    if (!ok) closePanel()
  }

  const sendReply = async () => {
    if (!selectedId || !reply.trim()) return
    setSending(true)
    try {
      await replyAdminTicket(selectedId, { body: reply.trim(), status: 'answered' })
      haptic('medium')
      setReply('')
      showNotification('پاسخ ارسال شد', 'success')
      await loadDetail(selectedId)
      await load()
    } catch (error) {
      showNotification(error instanceof Error ? error.message : 'خطا در ارسال پاسخ', 'error')
    } finally {
      setSending(false)
    }
  }

  const closeTicket = async () => {
    if (!selectedId || detail?.status === 'closed') return
    if (!window.confirm('این تیکت بسته شود؟')) return
    setSending(true)
    try {
      await replyAdminTicket(selectedId, {
        body: reply.trim() || 'تیکت توسط پشتیبانی بسته شد.',
        status: 'closed',
      })
      haptic('medium')
      setReply('')
      showNotification('تیکت بسته شد', 'warning')
      await loadDetail(selectedId)
      await load()
    } catch (error) {
      showNotification(error instanceof Error ? error.message : 'خطا در بستن تیکت', 'error')
    } finally {
      setSending(false)
    }
  }

  if (!ready || !allowed) return null

  const chatPanel =
    selectedId != null
      ? createPortal(
          <>
            <button
              type="button"
              className={`admin-ticket-sheet__backdrop${
                panelVisible ? ' admin-ticket-sheet__backdrop--visible' : ''
              }`}
              aria-label="بستن"
              onClick={closePanel}
            />
            <div
              className={`admin-ticket-sheet${panelVisible ? ' admin-ticket-sheet--visible' : ''}`}
              role="dialog"
              aria-modal="true"
              aria-label="گفتگوی تیکت"
            >
              <div className="admin-ticket-sheet__header">
                <PageHeader
                  title={detail ? `تیکت ${detail.ticketCode}` : 'جزئیات تیکت'}
                  onBack={closePanel}
                  action={
                    detail ? (
                      <span
                        className={`admin-ticket-item__badge admin-ticket-item__badge--${detail.status}`}
                      >
                        {ticketStatusLabel(detail.status)}
                      </span>
                    ) : undefined
                  }
                />
                {detail ? (
                  <div className="admin-ticket-sheet__meta">
                    <span className="admin-ticket-sheet__chip">{detail.userLabel}</span>
                    {detail.categoryLabel ? (
                      <span className="admin-ticket-sheet__chip">{detail.categoryLabel}</span>
                    ) : null}
                    {detail.orderId ? (
                      <span className="admin-ticket-sheet__chip admin-ticket-sheet__chip--muted">
                        سفارش {detail.orderId}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="admin-ticket-sheet__scroll">
                {detailLoading && !detail ? (
                  <p className="admin-empty">در حال بارگذاری…</p>
                ) : !detail ? (
                  <EmptyState compact title="تیکت پیدا نشد" />
                ) : (
                  <div className="admin-ticket-sheet__messages">
                    {detail.messages.map((message) => {
                      const isAdmin = message.senderRole === 'admin'
                      const showText =
                        message.body &&
                        !(
                          message.imageData &&
                          (message.body === '📷 تصویر' || message.body === 'تصویر')
                        )
                      return (
                        <div
                          key={message.id}
                          className={`admin-ticket-msg admin-ticket-msg--${
                            isAdmin ? 'admin' : 'user'
                          }`}
                        >
                          {message.imageData ? (
                            <button
                              type="button"
                              className="admin-ticket-msg__image-btn"
                              onClick={() => setViewerSrc(message.imageData!)}
                            >
                              <img src={message.imageData} alt="" />
                            </button>
                          ) : null}
                          {showText ? (
                            <p className="admin-ticket-msg__text">{message.body}</p>
                          ) : null}
                          <span className="admin-ticket-msg__time">
                            {isAdmin ? 'ادمین · ' : 'کاربر · '}
                            {formatFaTime(message.createdAt)}
                          </span>
                        </div>
                      )
                    })}
                    <div ref={bottomRef} />
                  </div>
                )}
              </div>

              {detail?.status === 'closed' ? (
                <p className="admin-ticket-sheet__closed">این تیکت بسته شده است</p>
              ) : detail ? (
                <div className="admin-ticket-sheet__composer">
                  <textarea
                    className="admin-ticket-sheet__input"
                    rows={2}
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    placeholder="پاسخ ادمین…"
                    maxLength={4000}
                  />
                  <div className="admin-ticket-sheet__actions">
                    <button
                      type="button"
                      className="admin-charge-item__btn admin-charge-item__btn--reject"
                      disabled={sending}
                      onClick={() => void closeTicket()}
                    >
                      بستن تیکت
                    </button>
                    <button
                      type="button"
                      className="admin-charge-item__btn admin-charge-item__btn--approve"
                      disabled={sending || !reply.trim()}
                      onClick={() => void sendReply()}
                    >
                      {sending ? '…' : 'ارسال پاسخ'}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </>,
          document.body,
        )
      : null

  return (
    <div className="admin-section">
      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title="تیکت‌های پشتیبانی" onBack={() => navigate('/admin')} />
      </div>

      <div className="admin-tabs shop-rise" style={{ '--rise-index': 1 } as CSSProperties}>
        {STATUS_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`admin-tabs__btn${status === item.id ? ' admin-tabs__btn--active' : ''}`}
            onClick={() => {
              haptic('light')
              setStatus(item.id)
            }}
          >
            <SolarIcon icon={item.icon} width={15} height={15} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      <div className="admin-ticket-cats shop-rise" style={{ '--rise-index': 2 } as CSSProperties}>
        {CATEGORY_CHIPS.map((item) => (
          <button
            key={item.value}
            type="button"
            className={`admin-ticket-cats__chip${
              category === item.value ? ' admin-ticket-cats__chip--active' : ''
            }`}
            onClick={() => {
              haptic('light')
              setCategory(item.value)
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="admin-ticket-list" aria-busy="true" aria-label="در حال بارگذاری">
          {[0, 1, 2].map((index) => (
            <TicketItemSkeleton key={index} index={index} />
          ))}
        </div>
      ) : null}

      {!loading && items.length === 0 ? <p className="admin-empty">تیکتی یافت نشد</p> : null}

      {!loading && items.length > 0 ? (
        <div className="admin-ticket-list">
          {items.map((ticket, index) => {
            const preview = ticket.lastMessage?.body?.slice(0, 90) || ticket.subject
            return (
              <button
                key={ticket.id}
                type="button"
                className={`admin-ticket-item shop-rise admin-ticket-item--${ticket.status}`}
                style={{ '--rise-index': Math.min(index + 2, 8) } as CSSProperties}
                onClick={() => void openTicket(ticket.id)}
              >
                <div className="admin-ticket-item__header">
                  <span className="admin-ticket-item__icon">
                    <SolarIcon icon="solar:ticket-bold-duotone" width={18} height={18} />
                  </span>
                  <div className="admin-ticket-item__summary">
                    <div className="admin-ticket-item__title-row">
                      <h3 className="admin-ticket-item__title">
                        {ticket.ticketCode}
                        <span className="admin-ticket-item__subject"> · {ticket.subject}</span>
                      </h3>
                      <span
                        className={`admin-ticket-item__badge admin-ticket-item__badge--${ticket.status}`}
                      >
                        {ticketStatusLabel(ticket.status)}
                      </span>
                    </div>
                    <p className="admin-ticket-item__preview">{preview}</p>
                  </div>
                </div>

                <div className="admin-ticket-item__meta">
                  <div className="admin-ticket-item__meta-chip">
                    <SolarIcon icon="solar:user-id-linear" width={12} height={12} />
                    <span>{displayUsername(ticket.user)}</span>
                  </div>
                  <div className="admin-ticket-item__meta-chip">
                    <SolarIcon icon="solar:folder-with-files-linear" width={12} height={12} />
                    <span>{ticket.categoryLabel}</span>
                  </div>
                  <div className="admin-ticket-item__meta-chip">
                    <SolarIcon icon="solar:calendar-linear" width={12} height={12} />
                    <span>{formatFaDateTime(ticket.updatedAt)}</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      ) : null}

      {!loading && items.length > 0 ? (
        <div className="admin-ticket-pager">
          <button
            type="button"
            className="admin-ticket-pager__btn"
            disabled={page <= 1 || loading}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          >
            قبلی
          </button>
          <span>
            {formatFaNumber(page)} / {formatFaNumber(totalPages)}
          </span>
          <button
            type="button"
            className="admin-ticket-pager__btn"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((prev) => prev + 1)}
          >
            بعدی
          </button>
        </div>
      ) : null}

      {chatPanel}

      <ImageViewer
        isOpen={Boolean(viewerSrc)}
        src={viewerSrc}
        alt="پیوست تیکت"
        onClose={() => setViewerSrc(null)}
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
