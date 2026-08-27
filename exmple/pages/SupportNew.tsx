import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import FolderAttachmentIcon from '../components/icons/folder-attachment-stroke-rounded'
import IdIcon from '../components/icons/IdIcon'
import Money03Icon from '../components/icons/money-03-stroke-rounded'
import NoteIcon from '../components/icons/NoteIcon'
import OrderIcon from '../components/icons/OrderIcon'
import ShopIcon from '../components/icons/ShopIcon'
import Ticket02Icon from '../components/icons/ticket-02-stroke-rounded'
import { EmptyState } from '../components/EmptyState'
import { Notification } from '../components/Notification'
import { PageHeader } from '../components/PageHeader'
import { useTelegram } from '../hooks/useTelegram'
import { balanceToToman } from '../lib/api'
import { formatAmountFa } from '../lib/amount'
import {
  SUPPORT_CATEGORIES,
  compressSupportImage,
  createSupportTicket,
  fetchSupportOrders,
  readLocalSupportTickets,
  writeLocalSupportTicket,
  writeLocalSupportTickets,
  type SupportCategory,
  type SupportOrderItem,
} from '../lib/supportApi'
import '../styles/shop-rise.css'
import './Support.css'

type Step = 'category' | 'order' | 'message'

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

function categoryIcon(value: SupportCategory): ReactNode {
  switch (value) {
    case 'sales':
      return <ShopIcon width={18} height={18} />
    case 'product':
      return <OrderIcon width={18} height={18} />
    case 'kyc':
      return <IdIcon width={18} height={18} />
    case 'wallet':
      return <Money03Icon width={18} height={18} />
    default:
      return <NoteIcon width={18} height={18} />
  }
}

function formatFaOrderDate(value: string): string {
  return new Date(value).toLocaleDateString('fa-IR', {
    month: 'short',
    day: 'numeric',
  })
}

export function SupportNewPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { haptic } = useTelegram()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const presetOrderId = searchParams.get('orderId')?.trim() || null
  const presetCategoryRaw = searchParams.get('category')?.trim() || null
  const presetCategory: SupportCategory | null =
    presetCategoryRaw && SUPPORT_CATEGORIES.some((item) => item.value === presetCategoryRaw)
      ? (presetCategoryRaw as SupportCategory)
      : presetOrderId
        ? 'product'
        : null
  const orderLocked = Boolean(presetOrderId)

  const [step, setStep] = useState<Step>(() => (presetOrderId ? 'message' : 'category'))
  const [category, setCategory] = useState<SupportCategory | null>(() => presetCategory)
  const [orderId, setOrderId] = useState<string | null>(() => presetOrderId)
  const [orders, setOrders] = useState<SupportOrderItem[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [body, setBody] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  }>({ show: false, message: '', type: 'error' })

  const selectedMeta = useMemo(
    () => SUPPORT_CATEGORIES.find((item) => item.value === category) ?? null,
    [category],
  )

  const selectedOrder = useMemo(
    () => orders.find((item) => item.orderId === orderId) ?? null,
    [orderId, orders],
  )

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true)
    try {
      const result = await fetchSupportOrders()
      setOrders(result.items)
    } catch {
      setOrders([])
    } finally {
      setOrdersLoading(false)
    }
  }, [])

  useEffect(() => {
    if (step === 'order' || (orderLocked && orderId)) void loadOrders()
  }, [loadOrders, orderId, orderLocked, step])

  const goBack = () => {
    haptic('light')
    if (orderLocked && step === 'message') {
      navigate(`/orders/${encodeURIComponent(presetOrderId!)}`, { replace: true })
      return
    }
    if (step === 'message') {
      setStep(selectedMeta?.suggestOrder ? 'order' : 'category')
      return
    }
    if (step === 'order') {
      setStep('category')
      return
    }
    navigate('/support', { replace: true })
  }

  const pickCategory = (value: SupportCategory) => {
    haptic('light')
    setCategory(value)
    setOrderId(null)
    const meta = SUPPORT_CATEGORIES.find((item) => item.value === value)
    setStep(meta?.suggestOrder ? 'order' : 'message')
  }

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

  const submit = async () => {
    if (!category) return
    const text = body.trim()
    if (!text && !imagePreview) return
    setSubmitting(true)
    try {
      const result = await createSupportTicket({
        category,
        body: text || undefined,
        orderId: orderId ?? undefined,
        imageData: imagePreview ?? undefined,
      })
      writeLocalSupportTicket(result)
      const listCache = readLocalSupportTickets()
      if (listCache) {
        const summary = {
          id: result.ticket.id,
          ticketCode: result.ticket.ticketCode,
          category: result.ticket.category,
          categoryLabel: result.ticket.categoryLabel,
          orderId: result.ticket.orderId,
          subject: result.ticket.subject,
          status: result.ticket.status,
          createdAt: result.ticket.createdAt,
          updatedAt: result.ticket.updatedAt,
          lastMessage: result.ticket.messages[0]
            ? {
                senderRole: result.ticket.messages[0].senderRole,
                body: result.ticket.messages[0].body,
                createdAt: result.ticket.messages[0].createdAt,
              }
            : null,
        }
        writeLocalSupportTickets({
          version: `local-${Date.now()}`,
          cachedAt: new Date().toISOString(),
          items: [summary, ...listCache.items.filter((item) => item.id !== summary.id)],
        })
      }
      haptic('medium')
      navigate(`/support/${result.ticket.ticketCode}`, { replace: true })
    } catch (error) {
      setNotification({
        show: true,
        message: error instanceof Error ? error.message : 'ثبت تیکت ناموفق بود',
        type: 'error',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const title = orderLocked
    ? 'تیکت سفارش'
    : step === 'category'
      ? 'موضوع تیکت'
      : step === 'order'
        ? 'سفارش مرتبط'
        : 'شرح درخواست'
  const canSubmit = Boolean(category && (body.trim() || imagePreview))

  return (
    <div className="support support--sub shop-rise">
      <PageHeader title={title} onBack={goBack} />

      {!orderLocked ? (
        <div className="support__steps" aria-hidden="true">
          {(selectedMeta?.suggestOrder === false
            ? (['category', 'message'] as Step[])
            : (['category', 'order', 'message'] as Step[])
          ).map((item, index, list) => {
            const stepIndex = list.indexOf(step)
            const itemIndex = index
            const active = itemIndex <= Math.max(0, stepIndex)
            const current = item === step
            return (
              <span
                key={item}
                className={`support__step-dot${active ? ' is-active' : ''}${current ? ' is-current' : ''}`}
              />
            )
          })}
        </div>
      ) : null}

      {step === 'category' && (
        <section className="support__new-block shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
          <p className="support__intro">کدام واحد باید به درخواستت رسیدگی کنه؟</p>
          <div className="support__pick-list">
            {SUPPORT_CATEGORIES.map((item) => (
              <button
                key={item.value}
                type="button"
                className="support__pick"
                onClick={() => pickCategory(item.value)}
              >
                <span className="support__pick-icon">{categoryIcon(item.value)}</span>
                <span className="support__pick-copy">
                  <span className="support__pick-title">{item.label}</span>
                  <span className="support__pick-hint">{item.hint}</span>
                </span>
                <span className="support__pick-arrow">
                  <ArrowIcon />
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 'order' && (
        <section className="support__new-block shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
          <p className="support__intro">
            اگر درخواستت مربوط به یک سفارش مشخصه، انتخابش کن تا سریع‌تر پیگیری بشه.
          </p>

          {selectedMeta && (
            <div className="support__context">
              <span className="support__context-icon">{categoryIcon(selectedMeta.value)}</span>
              <span className="support__context-text">{selectedMeta.label}</span>
            </div>
          )}

          {ordersLoading ? (
            <div className="support__order-list">
              {[0, 1, 2].map((index) => (
                <div key={index} className="support__order-card support__order-card--skeleton">
                  <span className="support__order-card-skel-top" />
                  <span className="support__order-card-skel-bottom" />
                </div>
              ))}
            </div>
          ) : orders.length === 0 ? (
            <EmptyState compact title="سفارشی برای نمایش نیست" />
          ) : (
            <div className="support__order-list">
              {orders.map((order) => (
                <button
                  key={order.orderId}
                  type="button"
                  className={`support__order-card${orderId === order.orderId ? ' is-active' : ''}`}
                  onClick={() => {
                    haptic('light')
                    setOrderId(order.orderId)
                    setStep('message')
                  }}
                >
                  <span className="support__order-card-top">
                    <span className="support__order-card-product">{order.category.label}</span>
                    <span className="support__order-card-amount">
                      {formatAmountFa(String(balanceToToman(order.amountToman)))}
                      <span className="support__order-card-unit">تومان</span>
                    </span>
                  </span>
                  <span className="support__order-card-bottom">
                    <span className="support__order-card-date">
                      {formatFaOrderDate(order.createdAt)}
                    </span>
                    <span className="support__order-card-id">{order.orderId}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="support__skip-wrap">
            <button
              type="button"
              className="support__skip"
              onClick={() => {
                haptic('light')
                setOrderId(null)
                setStep('message')
              }}
            >
              ادامه بدون سفارش
            </button>
          </div>
        </section>
      )}

      {step === 'message' && (
        <section className="support__form shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
          <div className="support__context-stack">
            {selectedMeta && (
              <div className="support__context">
                <span className="support__context-icon">{categoryIcon(selectedMeta.value)}</span>
                <span className="support__context-text">{selectedMeta.label}</span>
              </div>
            )}
            {selectedOrder && (
              <div className="support__context support__context--order">
                <span className="support__context-icon">
                  <OrderIcon width={16} height={16} />
                </span>
                <span className="support__context-text">
                  {selectedOrder.category.label}
                  {' · '}
                  {selectedOrder.orderId}
                </span>
              </div>
            )}
            {!selectedOrder && orderId && (
              <div className="support__context support__context--order">
                <span className="support__context-icon">
                  <Ticket02Icon width={16} height={16} />
                </span>
                <span className="support__context-text">سفارش {orderId}</span>
              </div>
            )}
          </div>

          <label className="support__compose-card">
            <span className="support__compose-label">پیام شما</span>
            <textarea
              className="support__textarea"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="مشکل یا درخواست را بنویسید…"
              maxLength={4000}
            />
          </label>

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

          {imagePreview ? (
            <div className="support__attach-preview support__attach-preview--form">
              <img src={imagePreview} alt="" />
              <div className="support__attach-preview-copy">
                <span>تصویر پیوست شد</span>
                <button
                  type="button"
                  className="support__attach-remove"
                  onClick={() => setImagePreview(null)}
                >
                  حذف
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="support__attach-row"
              onClick={() => fileRef.current?.click()}
            >
              <span className="support__attach-row-icon">
                <FolderAttachmentIcon width={18} height={18} />
              </span>
              <span className="support__attach-row-copy">
                <span className="support__attach-row-title">پیوست تصویر</span>
                <span className="support__attach-row-hint">اختیاری · اسکرین‌شات یا رسید</span>
              </span>
            </button>
          )}

          <button
            type="button"
            className="support__submit"
            disabled={submitting || !canSubmit}
            onClick={() => void submit()}
          >
            {submitting ? 'در حال ثبت…' : 'ثبت تیکت'}
          </button>
        </section>
      )}

      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification((prev) => ({ ...prev, show: false }))}
      />
    </div>
  )
}
