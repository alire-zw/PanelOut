import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import FolderAttachmentIcon from '../components/icons/folder-attachment-stroke-rounded'
import { EmptyState } from '../components/EmptyState'
import { ImageLightbox } from '../components/ImageLightbox'
import { Notification } from '../components/Notification'
import { PageHeader } from '../components/PageHeader'
import { useTelegram } from '../hooks/useTelegram'
import {
  compressSupportImage,
  fetchSupportTicket,
  readLocalSupportTicket,
  replySupportTicket,
  supportStatusLabel,
  supportTicketTitle,
  syncSupportTicket,
  writeLocalSupportTicket,
  type SupportTicketDetail,
  type SupportTicketDetailPayload,
} from '../lib/supportApi'
import '../styles/shop-rise.css'
import './Support.css'

function formatFaTime(value: string): string {
  return new Date(value).toLocaleTimeString('fa-IR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function SupportTicketPage() {
  const navigate = useNavigate()
  const { ticketCode: rawCode } = useParams()
  const ticketCode = rawCode ? decodeURIComponent(rawCode) : ''
  const { haptic } = useTelegram()
  const localCache = ticketCode ? readLocalSupportTicket(ticketCode) : null
  const [ticket, setTicket] = useState<SupportTicketDetail | null>(
    () => localCache?.ticket ?? null,
  )
  const [hasFetched, setHasFetched] = useState(() => Boolean(localCache))
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [draft, setDraft] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [viewerSrc, setViewerSrc] = useState<string | null>(null)
  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  }>({ show: false, message: '', type: 'error' })

  const applyTicketPayload = useCallback((payload: SupportTicketDetailPayload) => {
    setTicket(payload.ticket)
    writeLocalSupportTicket(payload)
  }, [])

  const refreshInBackground = useCallback(
    async (code: string, currentVersion?: string | null) => {
      setIsRefreshing(true)
      try {
        const syncResult = await syncSupportTicket(code, currentVersion ?? undefined)
        if (syncResult.changed) {
          applyTicketPayload(syncResult)
        }
      } catch {
        // background sync must not block chat
      } finally {
        setIsRefreshing(false)
      }
    },
    [applyTicketPayload],
  )

  const load = useCallback(async () => {
    if (!ticketCode) return
    const local = readLocalSupportTicket(ticketCode)
    if (local) {
      applyTicketPayload(local)
      setHasFetched(true)
      void refreshInBackground(ticketCode, local.version)
      return
    }

    try {
      const result = await fetchSupportTicket(ticketCode)
      applyTicketPayload(result)
      void refreshInBackground(ticketCode, result.version)
    } catch (error) {
      setNotification({
        show: true,
        message: error instanceof Error ? error.message : 'خطا در دریافت تیکت',
        type: 'error',
      })
    } finally {
      setHasFetched(true)
    }
  }, [applyTicketPayload, refreshInBackground, ticketCode])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [ticket?.messages.length])

  const pickImage = async (file: File | null) => {
    if (!file) return
    try {
      const dataUrl = await compressSupportImage(file)
      setImagePreview(dataUrl)
      haptic('light')
    } catch (error) {
      setNotification({
        show: true,
        message: error instanceof Error ? error.message : 'انتخاب تصویر ناموفق بود',
        type: 'error',
      })
    }
  }

  const send = async () => {
    if (!ticketCode || ticket?.status === 'closed') return
    const text = draft.trim()
    if (!text && !imagePreview) return
    setSending(true)
    try {
      const result = await replySupportTicket(ticketCode, {
        body: text || undefined,
        imageData: imagePreview ?? undefined,
      })
      applyTicketPayload(result)
      setDraft('')
      setImagePreview(null)
      haptic('light')
    } catch (error) {
      setNotification({
        show: true,
        message: error instanceof Error ? error.message : 'ارسال پیام ناموفق بود',
        type: 'error',
      })
    } finally {
      setSending(false)
    }
  }

  const headerTitle = ticket ? supportTicketTitle(ticket.ticketCode) : 'تیکت'
  const showSkeleton = !hasFetched && !ticket

  return (
    <div className="support support--chat shop-rise">
      <div className="support__top">
        <PageHeader
          title={headerTitle}
          onBack={() => navigate('/support', { replace: true })}
          action={
            ticket ? (
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
            ) : undefined
          }
        />
        {ticket ? (
          <div className="support__chat-meta-row">
            <span className="support__chat-chip">{ticket.categoryLabel}</span>
            {ticket.orderId ? (
              <span className="support__chat-chip support__chat-chip--muted">
                سفارش {ticket.orderId}
              </span>
            ) : null}
            {isRefreshing ? (
              <span className="support__section-sync" aria-label="در حال بروزرسانی" />
            ) : null}
          </div>
        ) : showSkeleton ? (
          <div className="support__chat-meta-row">
            <span className="support__chat-chip-skel" />
            <span className="support__chat-chip-skel support__chat-chip-skel--short" />
          </div>
        ) : null}
      </div>

      <div className="support__scroll">
        {showSkeleton ? (
          <div className="support__messages">
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className={`support__msg support__msg--skel ${
                  index % 2 === 0 ? 'support__msg--user' : 'support__msg--admin'
                }`}
              >
                <span className="support__msg-skel-bubble" />
              </div>
            ))}
          </div>
        ) : !ticket ? (
          <EmptyState title="تیکت پیدا نشد" />
        ) : (
          <div className="support__messages">
            {ticket.messages.map((message) => {
              const isUser = message.senderRole === 'user'
              const showText =
                message.body &&
                !(message.imageData && (message.body === '📷 تصویر' || message.body === 'تصویر'))
              return (
                <div
                  key={message.id}
                  className={`support__msg support__msg--${isUser ? 'user' : 'admin'}`}
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
                  {showText && <p className="support__msg-text">{message.body}</p>}
                  <span className="support__msg-time">{formatFaTime(message.createdAt)}</span>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {ticket?.status === 'closed' ? (
        <p className="support__closed-note">این تیکت بسته شده است</p>
      ) : ticket ? (
        <div className="support__composer-wrap">
          {imagePreview && (
            <div className="support__attach-preview">
              <img src={imagePreview} alt="" />
              <button
                type="button"
                className="support__attach-remove"
                onClick={() => setImagePreview(null)}
              >
                حذف
              </button>
            </div>
          )}
          <div className="support__composer">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="support__file-input"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null
                event.target.value = ''
                void pickImage(file)
              }}
            />
            <button
              type="button"
              className="support__attach-btn"
              aria-label="ارسال عکس"
              onClick={() => fileRef.current?.click()}
            >
              <FolderAttachmentIcon width={18} height={18} />
            </button>
            <textarea
              className="support__composer-input"
              rows={1}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="پیام…"
              maxLength={4000}
            />
            <button
              type="button"
              className="support__composer-send"
              disabled={sending || (!draft.trim() && !imagePreview)}
              onClick={() => void send()}
            >
              ارسال
            </button>
          </div>
        </div>
      ) : showSkeleton ? (
        <div className="support__composer-wrap">
          <div className="support__composer">
            <span className="support__composer-skel" />
            <span className="support__composer-skel support__composer-skel--send" />
          </div>
        </div>
      ) : null}

      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification((prev) => ({ ...prev, show: false }))}
      />
      <ImageLightbox src={viewerSrc} onClose={() => setViewerSrc(null)} />
    </div>
  )
}
