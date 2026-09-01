import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { formatPaymentDate } from '../lib/formatDate'
import { formatFaTrafficFromBytes } from '../lib/formatTraffic'
import { lockAppScroll, unlockAppScroll } from '../lib/scrollLock'
import type { AdminUsageInvoiceItem } from '../lib/paymentsApi'
import './TransactionDetailSheet.css'
import './ActionBottomSheet.css'

type DetailRow = {
  label: string
  value: ReactNode
  valueClassName?: string
}

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

function trafficFromBytes(bytes: string | number) {
  return formatFaTrafficFromBytes(bytes)
}

function walletSourceLabel(source: string) {
  if (source === 'panel') return 'کیف پول پنل'
  return 'کیف پول اصلی'
}

function buildRows(invoice: AdminUsageInvoiceItem): DetailRow[] {
  const traffic = trafficFromBytes(invoice.trafficBytes)
  const trafficAfter = trafficFromBytes(invoice.trafficAfterBytes)

  return [
    {
      label: 'مبلغ کسر',
      value: (
        <span className="transaction-detail__value--amount">
          <span>{formatFaNumber(invoice.amountIrt)}</span>
          <span className="transaction-detail__unit">تومان</span>
        </span>
      ),
      valueClassName: 'transaction-detail__value--failed',
    },
    {
      label: 'ترافیک این دوره',
      value: `${traffic.amount} ${traffic.unit}`,
    },
    {
      label: 'مجموع مصرف صورتحساب‌شده',
      value: `${trafficAfter.amount} ${trafficAfter.unit}`,
    },
    {
      label: 'نام کاربری پنل',
      value: invoice.clientUsername,
    },
    {
      label: 'نوع سرویس',
      value: panelServiceLabel(invoice.serviceType),
    },
    {
      label: 'منبع پرداخت',
      value: walletSourceLabel(invoice.walletSource),
    },
    {
      label: 'کاربر',
      value: invoice.userDisplayName,
      valueClassName: 'transaction-detail__value--note',
    },
    {
      label: 'شناسه تلگرام',
      value: String(invoice.telegramUserId),
    },
    ...(invoice.username
      ? [
          {
            label: 'یوزرنیم',
            value: `@${invoice.username}`,
          } satisfies DetailRow,
        ]
      : []),
    {
      label: 'شناسه فاکتور',
      value: String(invoice.id),
    },
    {
      label: 'شناسه اشتراک',
      value: String(invoice.subscriptionId),
    },
    {
      label: 'تاریخ',
      value: invoice.createdAt ? formatPaymentDate(invoice.createdAt) : '—',
    },
  ]
}

type UsageInvoiceDetailSheetProps = {
  isOpen: boolean
  invoice: AdminUsageInvoiceItem | null
  onClose: () => void
  onOpenUser?: (telegramUserId: number) => void
}

export function UsageInvoiceDetailSheet({
  isOpen,
  invoice: invoiceProp,
  onClose,
  onOpenUser,
}: UsageInvoiceDetailSheetProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [shouldRender, setShouldRender] = useState(false)
  const [heldInvoice, setHeldInvoice] = useState(invoiceProp)

  useEffect(() => {
    if (invoiceProp) setHeldInvoice(invoiceProp)
  }, [invoiceProp])

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsVisible(true))
      })
      return
    }

    setIsVisible(false)
    const timer = window.setTimeout(() => setShouldRender(false), 480)
    return () => window.clearTimeout(timer)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      unlockAppScroll()
      return
    }

    lockAppScroll()
    return () => unlockAppScroll()
  }, [isOpen])

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) onClose()
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!shouldRender || !heldInvoice) return null

  const rows = buildRows(heldInvoice)

  return createPortal(
    <>
      <div
        className={`transaction-detail__backdrop${
          isVisible ? ' transaction-detail__backdrop--visible' : ''
        }`}
        onClick={onClose}
        role="presentation"
      />

      <div
        className={`transaction-detail__panel${
          isVisible ? ' transaction-detail__panel--visible' : ''
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="جزئیات فاکتور مصرف"
      >
        <div className="transaction-detail__header">
          <div className="transaction-detail__handle" aria-hidden />
          <h3 className="transaction-detail__title">جزئیات فاکتور مصرف</h3>
        </div>

        <div className="transaction-detail__content">
          <div className="transaction-detail__card">
            {rows.map((row) => (
              <div key={row.label} className="transaction-detail__row">
                <span className="transaction-detail__label">{row.label}</span>
                <span
                  className={`transaction-detail__value${
                    row.valueClassName ? ` ${row.valueClassName}` : ''
                  }`}
                >
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          {onOpenUser ? (
            <div className="usage-invoice-sheet__actions">
              <button
                type="button"
                className="action-sheet__btn action-sheet__btn--primary"
                onClick={() => onOpenUser(heldInvoice.telegramUserId)}
              >
                مشاهده پروفایل کاربر
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </>,
    document.body,
  )
}
