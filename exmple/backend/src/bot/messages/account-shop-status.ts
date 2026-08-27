import { PAYMENT_SUCCESS_EMOJI, tgPremiumEmoji } from './premium-emoji.js'

export type AccountShopStatusNotify = 'registered' | 'processing' | 'delivered'

const STATUS_LABELS: Record<AccountShopStatusNotify, string> = {
  registered: 'تأیید شده',
  processing: 'در حال پردازش',
  delivered: 'تحویل شده',
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

export function accountShopStatusLabelFa(status: AccountShopStatusNotify): string {
  return STATUS_LABELS[status]
}

function statusNarrative(status: AccountShopStatusNotify): string {
  switch (status) {
    case 'registered':
      return 'سفارش شما مجدداً در وضعیت <b>تأیید شده</b> قرار گرفت و در صف بررسی کارشناسان ماست. به‌محض شروع آماده‌سازی، از همین‌جا مطلع می‌شوید.'
    case 'processing':
      return 'سفارش شما وارد مرحله <b>پردازش</b> شد و کارشناسان در حال آماده‌سازی اکانت هستند. پس از تکمیل، اطلاعات تحویل در جزئیات سفارش نمایش داده می‌شود.'
    case 'delivered':
      return 'سفارش شما با موفقیت <b>تحویل</b> شد. اطلاعات اکانت در بخش جزئیات سفارش آماده مشاهده و کپی است.'
  }
}

export function buildAccountShopStatusChangedMessage(input: {
  orderId: string
  status: AccountShopStatusNotify
  planName?: string | null
}): string {
  const { check, briefcase, plane, receipt, heart } = PAYMENT_SUCCESS_EMOJI
  const statusLabel = escapeHtml(accountShopStatusLabelFa(input.status))
  const orderId = escapeHtml(input.orderId)
  const plan = input.planName?.trim()

  const title =
    input.status === 'delivered'
      ? 'سفارش اکانت شما تحویل شد.'
      : input.status === 'processing'
        ? 'سفارش اکانت شما در حال پردازش است.'
        : 'وضعیت سفارش اکانت به‌روزرسانی شد.'

  const lines = [
    `${tgPremiumEmoji(check.fallback, check.id)} <b>${title}</b>`,
    `${tgPremiumEmoji(plane.fallback, plane.id)} ${statusNarrative(input.status)}`,
  ]

  if (plan) {
    lines.push(
      `${tgPremiumEmoji(briefcase.fallback, briefcase.id)} محصول: <b>${escapeHtml(plan)}</b>`,
    )
  }

  lines.push(
    `${tgPremiumEmoji(receipt.fallback, receipt.id)} شماره سفارش: <code>${orderId}</code>`,
    `${tgPremiumEmoji(heart.fallback, heart.id)} وضعیت فعلی: <b>${statusLabel}</b> — برای دیدن جزئیات کامل و اطلاعات تحویل، دکمه زیر را بزنید.`,
  )

  return lines.join('\n\n')
}
