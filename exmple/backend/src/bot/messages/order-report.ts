import { toJalaali } from 'jalaali-js'

export type OrderReportPayload = {
  orderId: string
  slug: string
  /** Human product name shown in report channels (plan / brand for account shop). */
  productLabel: string
  quantityLabel: string
  priceToman: number
  fulfilledAt: Date
  user: {
    telegramId: string
    username?: string | null
    firstName?: string | null
    lastName?: string | null
    realName?: string | null
    phoneNumber?: string | null
  }
}

const ORDER_LABELS: Record<string, string> = {
  'telegram-stars': 'TelegramStars',
  'telegram-premium': 'TelegramPremium',
  'virtual-number': 'VirtualNumber',
  reaction: 'Reaction',
  'channel-views': 'ChannelViews',
  'telegram-members': 'TelegramMembers',
  chatgpt: 'ChatGPT',
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function boldLabel(label: string): string {
  return `<b>${escapeHtml(label)}</b>`
}

export function formatOrderReportTime(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? '0')

  const j = toJalaali(get('year'), get('month'), get('day'))
  return `${j.jy}/${pad2(j.jm)}/${pad2(j.jd)} - ${pad2(get('hour'))}:${pad2(get('minute'))}`
}

export function formatPriceTomans(amount: number): string {
  return `${Math.round(amount).toLocaleString('en-US')} Tomans`
}

export function orderProductLabel(slug: string): string {
  return ORDER_LABELS[slug] ?? slug
}

/** 09991313105 / 989991313105 / +989991313105 → +989991313105 */
export function normalizeIranPhone(phone: string | null | undefined): string | null {
  const raw = phone?.trim()
  if (!raw) return null

  let digits = raw.replace(/\D/g, '')
  if (!digits) return null

  if (digits.startsWith('0')) {
    digits = `98${digits.slice(1)}`
  } else if (digits.startsWith('9') && digits.length === 10) {
    digits = `98${digits}`
  } else if (!digits.startsWith('98') && digits.length === 10) {
    digits = `98${digits}`
  }

  return `+${digits}`
}

export function censorUsername(username: string | null | undefined): string {
  const value = username?.replace(/^@/, '').trim()
  if (!value) return '—'
  if (value.length <= 4) return `@${value[0]}...${value.slice(-1)}`
  if (value.length <= 6) return `@${value.slice(0, 2)}...${value.slice(-2)}`
  return `@${value.slice(0, 4)}...${value.slice(-2)}`
}

export function censorPhone(phone: string | null | undefined): string {
  const normalized = normalizeIranPhone(phone)
  if (!normalized) return '—'
  if (normalized.length <= 10) {
    return `${normalized.slice(0, 4)}...${normalized.slice(-3)}`
  }
  return `${normalized.slice(0, 7)}...${normalized.slice(-5)}`
}

function displayUsernameMono(username: string | null | undefined): string {
  const value = username?.replace(/^@/, '').trim()
  if (!value) return '—'
  return `@${value}`
}

function displayUserFallback(user: OrderReportPayload['user']): string {
  if (user.realName?.trim()) return user.realName.trim()
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
  if (full) return full
  return user.telegramId
}

export function buildPurchaseChannelOrderMessage(
  input: OrderReportPayload & { timeLabel: string },
): string {
  return [
    `📟 ${boldLabel('NewOrder:')} ${escapeHtml(input.orderId)}`,
    '',
    `🙋🏻‍♂️ ${boldLabel('UserName:')} <code>${escapeHtml(censorUsername(input.user.username))}</code>`,
    `📞 ${boldLabel('UserNumber:')} ${escapeHtml(censorPhone(input.user.phoneNumber))}`,
    '',
    `⁉️ ${boldLabel('Order:')} ${escapeHtml(input.productLabel)}`,
    `👀 ${boldLabel('Quintity:')} ${escapeHtml(input.quantityLabel)}`,
    '',
    `⏳ ${boldLabel('Time:')} ${escapeHtml(input.timeLabel)}`,
    `💸 ${boldLabel('Price:')} ${escapeHtml(formatPriceTomans(input.priceToman))}`,
  ].join('\n')
}

export function buildAdminChannelOrderMessage(
  input: OrderReportPayload & { timeLabel: string },
): string {
  const username = input.user.username?.trim()
  const userLine = username
    ? `<code>${escapeHtml(displayUsernameMono(username))}</code>`
    : escapeHtml(displayUserFallback(input.user))

  const phone = normalizeIranPhone(input.user.phoneNumber)

  const lines = [
    `📥 ${boldLabel('New Order:')} ${escapeHtml(input.orderId)}`,
    '',
    `🙋🏻‍♂️ ${boldLabel('User:')} ${userLine}`,
    `📟 ${boldLabel('UserID:')} ${escapeHtml(input.user.telegramId)}`,
  ]

  if (phone) {
    lines.push(`📞 ${boldLabel('UserNumber:')} ${escapeHtml(phone)}`)
  }

  lines.push(
    `⁉️ ${boldLabel('Order:')} ${escapeHtml(input.productLabel)}`,
    `👀 ${boldLabel('Quantity:')} ${escapeHtml(input.quantityLabel)}`,
    `⏳ ${boldLabel('Time:')} ${escapeHtml(input.timeLabel)}`,
    `💸 ${boldLabel('Price:')} ${escapeHtml(formatPriceTomans(input.priceToman))}`,
  )

  return lines.join('\n')
}
