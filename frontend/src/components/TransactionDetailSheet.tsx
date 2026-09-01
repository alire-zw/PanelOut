import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { formatPaymentDate } from '../lib/formatDate'
import { formatFaTraffic } from '../lib/formatTraffic'
import { lockAppScroll, unlockAppScroll } from '../lib/scrollLock'
import type { WalletTransaction } from '../types/wallet'
import './TransactionDetailSheet.css'

type DetailRow = {
  label: string
  value: ReactNode
  valueClassName?: string
}

function getStatusLabel(transaction: WalletTransaction): string {
  switch (transaction.status) {
    case 'success':
      return 'موفق'
    case 'failed':
      return 'ناموفق'
    case 'pending':
      if (transaction.paymentMethod === 'card') return 'در انتظار تأیید'
      return transaction.type === 'purchase' ? 'در حال پردازش' : 'در انتظار پرداخت'
    default:
      return '—'
  }
}

function getPaymentMethodLabel(transaction: WalletTransaction): string {
  if (transaction.type === 'transfer') {
    if (transaction.transferDirection === 'in') return 'دریافت از کاربر'
    if (transaction.transferDirection === 'out') return 'انتقال به کاربر'
    return 'انتقال موجودی'
  }
  if (transaction.type === 'panel_usage' || transaction.type === 'outbound_usage') {
    return transaction.walletSource === 'panel' ? 'کیف پول پنل' : 'موجودی کیف پول'
  }
  if (transaction.type === 'outbound_volume_purchase') {
    return 'موجودی کیف پول'
  }
  if (
    transaction.paymentMethod === 'zibal' &&
    (transaction.walletAmountToman ?? 0) > 0 &&
    (transaction.gatewayAmountToman ?? 0) > 0
  ) {
    return 'کیف پول + درگاه بانکی'
  }
  if (transaction.paymentMethod === 'wallet') return 'موجودی کیف پول'
  if (transaction.paymentMethod === 'tron') return 'ترون (TRX)'
  if (transaction.paymentMethod === 'card') return 'کارت‌به‌کارت'
  if (transaction.paymentMethod === 'zibal') return 'درگاه بانکی'
  return '—'
}

function formatTrxAmount(value: string | null | undefined): string | null {
  if (!value) return null
  const amount = Number.parseFloat(value)
  if (!Number.isFinite(amount)) return value
  return amount.toLocaleString('fa-IR', { maximumFractionDigits: 6 })
}

function shortenHash(value: string): string {
  if (value.length <= 16) return value
  return `${value.slice(0, 8)}...${value.slice(-8)}`
}

function panelServiceTypeLabel(type: WalletTransaction['panelServiceType']): string {
  if (type === 'outbound_volume') return 'اوتباند حجمی'
  if (type === 'outbound_usage') return 'اوتباند مصرفی'
  if (type === 'panel_reseller') return 'ریسلری'
  if (type === 'panel_usage') return 'مصرفی شخصی'
  return '—'
}

function transactionTypeLabel(transaction: WalletTransaction): string {
  if (transaction.type === 'outbound_usage') return 'فاکتور مصرف اوتباند'
  if (transaction.type === 'outbound_volume_purchase') return 'خرید اوتباند حجمی'
  if (transaction.type === 'panel_usage') return 'فاکتور مصرف پنل'
  return transaction.title
}

function buildDetailRows(transaction: WalletTransaction): DetailRow[] {
  const rows: DetailRow[] = [
    {
      label: 'وضعیت',
      value: getStatusLabel(transaction),
      valueClassName: `transaction-detail__value--${transaction.status}`,
    },
    {
      label: 'نوع تراکنش',
      value: transactionTypeLabel(transaction),
    },
    {
      label: 'تاریخ ثبت',
      value: transaction.createdAt ? formatPaymentDate(transaction.createdAt) : transaction.date,
    },
  ]

  if (transaction.verifiedAt) {
    rows.push({
      label: 'تاریخ تأیید',
      value: formatPaymentDate(transaction.verifiedAt),
    })
  }

  if (transaction.expiresAt && transaction.status !== 'success') {
    rows.push({
      label: 'تاریخ انقضا',
      value: formatPaymentDate(transaction.expiresAt),
    })
  }

  rows.push(
    {
      label: 'مبلغ',
      value: (
        <>
          <span className="transaction-detail__unit">تومان</span>
          <span>
            {transaction.status !== 'failed' && transaction.amount !== 0
              ? `${transaction.amount > 0 ? '+' : '-'}${Math.abs(transaction.amount).toLocaleString('fa-IR')}`
              : Math.abs(transaction.amount).toLocaleString('fa-IR')}
          </span>
        </>
      ),
      valueClassName:
        transaction.status === 'failed'
          ? 'transaction-detail__value--amount transaction-detail__value--failed'
          : transaction.status === 'pending'
            ? 'transaction-detail__value--amount transaction-detail__value--pending'
            : 'transaction-detail__value--amount transaction-detail__value--success',
    },
    {
      label:
        transaction.type === 'panel_usage' || transaction.type === 'outbound_usage'
          ? 'شماره فاکتور'
          : 'شماره سفارش',
      value: transaction.orderId ?? '—',
    },
  )

  if (
    transaction.type === 'purchase' &&
    (transaction.walletAmountToman ?? 0) > 0 &&
    (transaction.gatewayAmountToman ?? 0) > 0
  ) {
    rows.push(
      {
        label: 'از کیف پول',
        value: (
          <>
            <span className="transaction-detail__unit">تومان</span>
            <span>{transaction.walletAmountToman!.toLocaleString('fa-IR')}</span>
          </>
        ),
        valueClassName: 'transaction-detail__value--amount',
      },
      {
        label: 'از درگاه',
        value: (
          <>
            <span className="transaction-detail__unit">تومان</span>
            <span>{transaction.gatewayAmountToman!.toLocaleString('fa-IR')}</span>
          </>
        ),
        valueClassName: 'transaction-detail__value--amount',
      },
    )
  }

  if (transaction.type === 'panel_usage' || transaction.type === 'outbound_usage') {
    if (transaction.chargeCount && transaction.chargeCount > 1) {
      rows.push({
        label: 'تعداد دوره',
        value: `${transaction.chargeCount.toLocaleString('fa-IR')} مورد`,
      })
    }
    if (transaction.panelUsername) {
      rows.push({
        label: transaction.type === 'outbound_usage' ? 'سرویس' : 'پنل',
        value: (
          <span dir="ltr" style={{ unicodeBidi: 'plaintext' }}>
            {transaction.panelUsername}
          </span>
        ),
      })
    }
    if (transaction.panelServiceType) {
      rows.push({
        label: transaction.type === 'outbound_usage' ? 'نوع سرویس' : 'نوع پنل',
        value: panelServiceTypeLabel(transaction.panelServiceType),
      })
    }
    if (transaction.trafficGb) {
      rows.push({
        label: 'حجم مصرف',
        value: formatFaTraffic(transaction.trafficGb, 'long'),
      })
    }
    if (
      transaction.dateFrom &&
      transaction.dateTo &&
      transaction.dateFrom !== transaction.dateTo
    ) {
      rows.push(
        {
          label: 'از',
          value: formatPaymentDate(transaction.dateFrom),
        },
        {
          label: 'تا',
          value: formatPaymentDate(transaction.dateTo),
        },
      )
    }
  }

  if (transaction.type === 'outbound_volume_purchase') {
    if (transaction.panelUsername) {
      rows.push({
        label: 'سرویس',
        value: (
          <span dir="ltr" style={{ unicodeBidi: 'plaintext' }}>
            {transaction.panelUsername}
          </span>
        ),
      })
    }
    if (transaction.quantity) {
      rows.push({
        label: 'حجم خرید',
        value: `${transaction.quantity.toLocaleString('fa-IR')} گیگابایت`,
      })
    }
  }

  if (transaction.type === 'transfer' && transaction.counterpartyTelegramId) {
    rows.push({
      label: transaction.transferDirection === 'in' ? 'فرستنده' : 'گیرنده',
      value: transaction.counterpartyTelegramId.toString(),
    })
  } else {
    rows.push({
      label: 'روش پرداخت',
      value: getPaymentMethodLabel(transaction),
    })
  }

  if (transaction.paymentMethod === 'zibal') {
    if (transaction.trackId) {
      rows.push({ label: 'کد پیگیری', value: transaction.trackId })
    }
    if (transaction.refNumber) {
      rows.push({ label: 'شماره مرجع', value: transaction.refNumber })
    }
    if (transaction.cardNumber) {
      rows.push({ label: 'شماره کارت', value: transaction.cardNumber })
    }
  }

  if (transaction.paymentMethod === 'card' && transaction.cardNumber) {
    rows.push({
      label: 'کارت مقصد',
      value: transaction.cardNumber.replace(/(\d{4})(?=\d)/g, '$1 ').trim(),
    })
  }

  if (
    transaction.status === 'failed' &&
    transaction.paymentMethod === 'card' &&
    transaction.adminNote?.trim()
  ) {
    rows.push({
      label: 'دلیل رد',
      value: transaction.adminNote.trim(),
      valueClassName: 'transaction-detail__value--failed transaction-detail__value--note',
    })
  }

  if (transaction.paymentMethod === 'tron') {
    const trxAmount = formatTrxAmount(transaction.amountTrx)
    if (trxAmount) {
      rows.push({
        label: 'مبلغ TRX',
        value: (
          <>
            <span className="transaction-detail__unit">TRX</span>
            <span>{trxAmount}</span>
          </>
        ),
        valueClassName: 'transaction-detail__value--amount',
      })
    }
    if (transaction.incomingTxHash) {
      rows.push({
        label: 'هش تراکنش',
        value: shortenHash(transaction.incomingTxHash),
        valueClassName: 'transaction-detail__value--hash',
      })
    }
  }

  return rows
}

type TransactionDetailSheetProps = {
  isOpen: boolean
  transaction: WalletTransaction | null
  onClose: () => void
}

export function TransactionDetailSheet({
  isOpen,
  transaction: transactionProp,
  onClose,
}: TransactionDetailSheetProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [shouldRender, setShouldRender] = useState(false)
  const [heldTransaction, setHeldTransaction] = useState(transactionProp)

  useEffect(() => {
    if (transactionProp) setHeldTransaction(transactionProp)
  }, [transactionProp])

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

  if (!shouldRender || !heldTransaction) return null

  const transaction = heldTransaction
  const rows = buildDetailRows(transaction)

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
        aria-label="جزئیات تراکنش"
      >
        <div className="transaction-detail__header">
          <div className="transaction-detail__handle" aria-hidden />
          <h3 className="transaction-detail__title">جزئیات تراکنش</h3>
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
        </div>
      </div>
    </>,
    document.body,
  )
}
