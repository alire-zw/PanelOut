import {
  formatJalaliDateLong,
  formatJalaliDateTime,
  formatJalaliDayOfMonth,
} from '../../lib/jalaaliDate'

export function formatFaNumber(value: number | string): string {
  const num = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(num)) return '۰'
  return Math.floor(num).toLocaleString('fa-IR')
}

/** Gregorian day key or ISO → Jalali via jalaali-js (not Intl). */
export function formatFaDate(iso: string | null | undefined): string {
  return formatJalaliDateTime(iso)
}

/** e.g. ۲۸ فروردین ۱۴۰۵ — always Jalali via jalaali-js */
export function formatFaDateLong(iso: string | null | undefined): string {
  return formatJalaliDateLong(iso)
}

export function formatFaDateTimeLong(iso: string | null | undefined): string {
  if (!iso) return '—'
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso.trim())) {
    return formatJalaliDateLong(iso)
  }
  return formatJalaliDateTime(iso)
}

/** Chart axis day number in Jalali calendar. */
export function formatFaChartDay(dayKey: string): string {
  return formatFaNumber(formatJalaliDayOfMonth(dayKey))
}

export function orderStatusLabel(status: string): string {
  switch (status) {
    case 'pending':
      return 'در انتظار'
    case 'processing':
      return 'در حال انجام'
    case 'completed':
      return 'موفق'
    case 'failed':
      return 'ناموفق'
    case 'cancelled':
      return 'لغو شده'
    default:
      return status
  }
}

/** User-facing order badge for account shop based on fulfillment status. */
export function userOrderStatusLabel(order: {
  status: string
  category: { slug: string }
  accountShopOrder?: { status: 'registered' | 'processing' | 'delivered' } | null
}): string {
  if (order.category.slug === 'chatgpt') {
    if (order.status === 'failed' || order.status === 'cancelled') {
      return orderStatusLabel(order.status)
    }
    if (order.status === 'pending') return 'در انتظار'
    const fulfillment = order.accountShopOrder?.status
    if (fulfillment === 'processing') return 'در حال پردازش'
    if (fulfillment === 'delivered' || order.status === 'completed') return 'تحویل شده'
    // registered (paid, awaiting admin work)
    return 'موفق'
  }
  return orderStatusLabel(order.status)
}

export function userOrderStatusTone(
  order: {
    status: string
    category: { slug: string }
    accountShopOrder?: { status: 'registered' | 'processing' | 'delivered' } | null
  },
): 'pending' | 'processing' | 'done' | 'failed' {
  if (order.category.slug === 'chatgpt') {
    if (order.status === 'failed' || order.status === 'cancelled') return 'failed'
    if (order.status === 'pending') return 'pending'
    if (order.accountShopOrder?.status === 'processing') return 'processing'
    return 'done'
  }
  if (order.status === 'completed') return 'done'
  if (order.status === 'failed' || order.status === 'cancelled') return 'failed'
  if (order.status === 'processing') return 'processing'
  return 'pending'
}

export function orderStatusBadgeClass(status: string): string {
  if (status === 'completed') return 'admin__badge admin__badge--success'
  if (status === 'failed' || status === 'cancelled') {
    return 'admin__badge admin__badge--error'
  }
  if (status === 'pending' || status === 'processing') {
    return 'admin__badge admin__badge--warn'
  }
  return 'admin__badge'
}

export function paymentStatusLabel(status: string): string {
  switch (status) {
    case 'pending':
      return 'در انتظار پرداخت'
    case 'paid':
      return 'پرداخت‌شده'
    case 'verified':
      return 'تأیید شده'
    case 'failed':
      return 'ناموفق'
    default:
      return status
  }
}

export function cryptoStatusLabel(status: string): string {
  switch (status) {
    case 'pending':
      return 'در انتظار واریز'
    case 'completed':
      return 'تکمیل‌شده'
    case 'expired':
      return 'منقضی'
    case 'swept':
      return 'جمع‌آوری‌شده'
    default:
      return status
  }
}

export function paymentMethodLabel(method: string): string {
  switch (method) {
    case 'wallet':
      return 'کیف پول'
    case 'zibal':
      return 'درگاه زیبال'
    case 'tron':
      return 'ترون'
    default:
      return method
  }
}

export function roleLabel(role: string): string {
  switch (role) {
    case 'admin':
      return 'ادمین'
    case 'supervisor':
      return 'سوپروایزر'
    case 'user':
      return 'کاربر'
    default:
      return role
  }
}

export function displayUsername(user: {
  username?: string | null
  firstName?: string | null
  lastName?: string | null
  id?: number
}): string {
  if (user.username) return `@${user.username}`
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ')
  if (name) return name
  if (user.id) return `کاربر ${formatFaNumber(user.id)}`
  return 'کاربر'
}

export function orderTitle(categoryLabel: string, amountToman: string | number): string {
  return `${categoryLabel} · ${formatFaNumber(amountToman)} تومان`
}

export function paymentTitle(orderId: string): string {
  const short = orderId.replace(/^NS-?/i, '').slice(-6)
  const numeric = Number(short.replace(/\D/g, ''))
  if (Number.isFinite(numeric) && numeric > 0) {
    return `پرداخت شماره ${formatFaNumber(numeric)}`
  }
  return `پرداخت ${orderId.slice(-8)}`
}

export function cryptoPaymentTitle(_orderId: string, amountTrx: string | number): string {
  return `ترون · ${formatFaNumber(amountTrx)} TRX`
}

export function transferTitle(amountToman: string | number): string {
  return `انتقال ${formatFaNumber(amountToman)} تومان`
}

export function ticketTitle(ticketCode: string, subject: string): string {
  return `تیکت ${ticketCode} · ${subject}`
}

export function ticketStatusLabel(status: string): string {
  switch (status) {
    case 'open':
      return 'باز'
    case 'answered':
      return 'پاسخ‌داده‌شده'
    case 'closed':
      return 'بسته‌شده'
    default:
      return status
  }
}

export function accountShopFulfillmentLabel(status: string): string {
  switch (status) {
    case 'registered':
      return 'تأیید شده'
    case 'processing':
      return 'در حال پردازش'
    case 'delivered':
      return 'تحویل شده'
    default:
      return status
  }
}

export function accountShopFulfillmentBadgeClass(status: string): string {
  if (status === 'delivered') return 'admin__badge admin__badge--success'
  if (status === 'processing') return 'admin__badge admin__badge--warn'
  return 'admin__badge'
}

export function clubRewardTypeLabel(type: string): string {
  switch (type) {
    case 'percent_discount':
      return 'تخفیف درصدی'
    case 'fixed_discount':
      return 'تخفیف مبلغی'
    case 'free_item':
      return 'آیتم رایگان'
    case 'custom':
      return 'سفارشی'
    default:
      return type
  }
}

export function discountTypeLabel(type: string): string {
  return type === 'percent' ? 'درصدی' : 'مبلغ ثابت'
}
