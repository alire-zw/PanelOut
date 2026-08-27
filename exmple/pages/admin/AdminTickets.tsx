import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '../../components/EmptyState'
import { ImageLightbox } from '../../components/ImageLightbox'
import ArrowBackIcon from '../../components/icons/ArrowBackIcon'
import { useAdminAccess } from '../../hooks/useAdminAccess'
import { useTelegram } from '../../hooks/useTelegram'
import {
  fetchAdminTicket,
  fetchAdminTickets,
  replyAdminTicket,
  type AdminTicketListItem,
} from '../../lib/adminApi'
import { lockAppScroll, unlockAppScroll } from '../../lib/scrollLock'
import {
  displayUsername,
  formatFaDateLong,
  formatFaNumber,
  orderStatusBadgeClass,
  ticketStatusLabel,
  ticketTitle,
} from './adminLabels'
import { AdminScreen } from './AdminScreen'
import '../Support.css'

const STATUS_FILTERS = [
  { value: 'all', label: 'همه' },
  { value: 'open', label: 'باز' },
  { value: 'answered', label: 'پاسخ‌داده‌شده' },
  { value: 'closed', label: 'بسته' },
]

const CATEGORY_FILTERS = [
  { value: 'all', label: 'همه دسته‌ها' },
  { value: 'sales', label: 'فروش' },
  { value: 'product', label: 'محصول' },
  { value: 'kyc', label: 'احراز' },
  { value: 'wallet', label: 'کیف پول' },
  { value: 'other', label: 'سایر' },
]

const CATEGORY_ORDER = ['sales', 'product', 'kyc', 'wallet', 'other'] as const

function formatFaTime(value: string): string {
  return new Date(value).toLocaleTimeString('fa-IR', {
    hour: '2-digit',
    minute: '2-digit',
  })
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

  const groupedItems = useMemo(() => {
    if (category !== 'all') {
      if (items.length === 0) return []
      return [
        {
          key: category,
          label:
            items[0]?.categoryLabel ??
            CATEGORY_FILTERS.find((item) => item.value === category)?.label ??
            category,
          items,
        },
      ]
    }

    const byCategory = new Map<string, AdminTicketListItem[]>()
    for (const ticket of items) {
      const list = byCategory.get(ticket.category) ?? []
      list.push(ticket)
      byCategory.set(ticket.category, list)
    }

    return CATEGORY_ORDER.flatMap((key) => {
      const groupItems = byCategory.get(key)
      if (!groupItems?.length) return []
      return [
        {
          key,
          label: groupItems[0]?.categoryLabel ?? key,
          items: groupItems,
        },
      ]
    })
  }, [category, items])

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
      setNotification({
        show: true,
        message: error instanceof Error ? error.message : 'خطا در دریافت تیکت‌ها',
        type: 'error',
      })
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
      setNotification({
        show: true,
        message: error instanceof Error ? error.message : 'خطا در دریافت تیکت',
        type: 'error',
      })
      return false
    } finally {
      setDetailLoading(false)
    }
  }

  const openTicket = async (id: number) => {
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
      setNotification({ show: true, message: 'پاسخ ارسال شد', type: 'success' })
      await loadDetail(selectedId)
      await load()
    } catch (error) {
      setNotification({
        show: true,
        message: error instanceof Error ? error.message : 'خطا در ارسال پاسخ',
        type: 'error',
      })
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
      setNotification({ show: true, message: 'تیکت بسته شد', type: 'success' })
      await loadDetail(selectedId)
      await load()
    } catch (error) {
      setNotification({
        show: true,
        message: error instanceof Error ? error.message : 'خطا در بستن تیکت',
        type: 'error',
      })
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
              className={`admin-ticket-chat__backdrop${panelVisible ? ' admin-ticket-chat__backdrop--visible' : ''}`}
              aria-label="بستن"
              onClick={closePanel}
            />
            <div
              className={`admin-ticket-chat${panelVisible ? ' admin-ticket-chat--visible' : ''}`}
              role="dialog"
              aria-modal="true"
              aria-label="گفتگوی تیکت"
            >
              <header className="admin-ticket-chat__header">
                <button
                  type="button"
                  className="admin-screen__back"
                  onClick={closePanel}
                  aria-label="بازگشت"
                >
                  <ArrowBackIcon width={20} height={20} />
                </button>
                <div className="admin-ticket-chat__titles">
                  <h2 className="admin-ticket-chat__title">
                    {detail
                      ? ticketTitle(detail.ticketCode, detail.subject)
                      : 'جزئیات تیکت'}
                  </h2>
                  {detail && (
                    <p className="admin-ticket-chat__sub">
                      {detail.userLabel}
                      {detail.categoryLabel ? ` · ${detail.categoryLabel}` : ''}
                      {' · '}
                      {ticketStatusLabel(detail.status)}
                      {detail.orderId ? ` · سفارش ${detail.orderId}` : ''}
                    </p>
                  )}
                </div>
              </header>

              <div className="admin-ticket-chat__scroll support__scroll">
                {detailLoading && !detail ? (
                  <p className="support__muted">در حال بارگذاری…</p>
                ) : !detail ? (
                  <EmptyState compact title="تیکت پیدا نشد" />
                ) : (
                  <div className="support__messages">
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
                          className={`support__msg support__msg--${isAdmin ? 'user' : 'admin'}`}
                        >
                          {message.imageData && (
                            <button
                              type="button"
                              className="support__msg-image-btn"
                              onClick={() => setViewerSrc(message.imageData!)}
                            >
                              <img
                                src={message.imageData}
                                alt=""
                                className="support__msg-image"
                              />
                            </button>
                          )}
                          {showText && (
                            <p className="support__msg-text">{message.body}</p>
                          )}
                          <span className="support__msg-time">
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
                <p className="support__closed-note">این تیکت بسته شده است</p>
              ) : detail ? (
                <div className="support__composer-wrap">
                  <div className="support__composer">
                    <textarea
                      className="support__composer-input"
                      rows={1}
                      value={reply}
                      onChange={(event) => setReply(event.target.value)}
                      placeholder="پاسخ ادمین…"
                      maxLength={4000}
                    />
                    <button
                      type="button"
                      className="support__composer-send"
                      disabled={sending || !reply.trim()}
                      onClick={() => void sendReply()}
                    >
                      {sending ? '…' : 'ارسال'}
                    </button>
                  </div>
                  <div className="admin-ticket-chat__actions">
                    <button
                      type="button"
                      className="admin-ticket-chat__close-btn"
                      disabled={sending}
                      onClick={() => void closeTicket()}
                    >
                      بستن تیکت
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
    <>
      <AdminScreen
        sticky
        title="پشتیبانی و تیکت"
        eyebrow="پشتیبانی"
        onBack={handleBack}
        notification={notification}
        onCloseNotification={() => setNotification((prev) => ({ ...prev, show: false }))}
        top={
          <div className="admin__toolbar">
            <div className="admin__filters">
              {STATUS_FILTERS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`admin__chip${status === item.value ? ' admin__chip--active' : ''}`}
                  onClick={() => {
                    haptic('light')
                    setStatus(item.value)
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="admin__filters">
              {CATEGORY_FILTERS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`admin__chip${category === item.value ? ' admin__chip--active' : ''}`}
                  onClick={() => {
                    haptic('light')
                    setCategory(item.value)
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        }
      >
        {loading ? (
          <p className="admin__muted">در حال بارگذاری…</p>
        ) : items.length === 0 ? (
          <EmptyState title="تیکتی ثبت نشده" />
        ) : (
          <div className="admin-ticket-groups">
            {groupedItems.map((group) => (
              <section key={group.key} className="admin-ticket-group">
                <h3 className="admin-ticket-group__title">{group.label}</h3>
                <ul className="admin__list">
                  {group.items.map((ticket) => (
                    <li key={ticket.id}>
                      <button
                        type="button"
                        className="admin__row"
                        onClick={() => void openTicket(ticket.id)}
                      >
                        <div className="admin__row-top">
                          <span className="admin__row-title">
                            {ticketTitle(ticket.ticketCode, ticket.subject)}
                          </span>
                          <span
                            className={orderStatusBadgeClass(
                              ticket.status === 'closed'
                                ? 'failed'
                                : ticket.status === 'answered'
                                  ? 'completed'
                                  : 'pending',
                            )}
                          >
                            {ticketStatusLabel(ticket.status)}
                          </span>
                        </div>
                        <div className="admin__row-meta">
                          {displayUsername(ticket.user)}
                          {ticket.orderId ? ` · ${ticket.orderId}` : ''}
                          {' · '}
                          {formatFaDateLong(ticket.updatedAt)}
                        </div>
                        {ticket.lastMessage && (
                          <div className="admin__row-meta">
                            {ticket.lastMessage.body.slice(0, 80)}
                          </div>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        <div className="admin__pager">
          <button
            type="button"
            className="admin__pager-btn"
            disabled={page <= 1 || loading}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          >
            قبلی
          </button>
          <span className="admin__muted" style={{ margin: 0 }}>
            {formatFaNumber(page)} / {formatFaNumber(totalPages)}
          </span>
          <button
            type="button"
            className="admin__pager-btn"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((prev) => prev + 1)}
          >
            بعدی
          </button>
        </div>
        <div style={{ height: 16 }} />
      </AdminScreen>

      {chatPanel}
      <ImageLightbox src={viewerSrc} onClose={() => setViewerSrc(null)} />
    </>
  )
}
