import type { SupportTicketCategory } from '@prisma/client'

export type AdminTicketReportKind = 'created' | 'reply'

interface AdminTicketReportMessageInput {
  kind?: AdminTicketReportKind
  ticketCode: string
  category: SupportTicketCategory
  orderId?: string | null
  user: {
    telegramId: string
    username?: string | null
    firstName?: string | null
    lastName?: string | null
    realName?: string | null
  }
}

const REASON_LABELS: Record<SupportTicketCategory, string> = {
  sales: 'SalesSupport',
  product: 'ProductsSupport',
  kyc: 'KycSupport',
  wallet: 'WalletSupport',
  other: 'OtherSupport',
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function boldLabel(label: string): string {
  return `<b>${escapeHtml(label)}</b>`
}

function displayUser(user: AdminTicketReportMessageInput['user']): string {
  if (user.username?.trim()) {
    return `<code>${escapeHtml(`@${user.username.trim()}`)}</code>`
  }
  if (user.realName?.trim()) return escapeHtml(user.realName.trim())
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
  if (full) return escapeHtml(full)
  return escapeHtml(user.telegramId)
}

export function buildAdminTicketReportMessage(input: AdminTicketReportMessageInput): string {
  const kind = input.kind ?? 'created'
  const headline =
    kind === 'reply'
      ? `💬 ${boldLabel('New Ticket Reply:')} ${escapeHtml(input.ticketCode)}`
      : `📥 ${boldLabel('New Support Ticket:')} ${escapeHtml(input.ticketCode)}`

  const lines = [
    headline,
    '',
    `🙋🏻‍♂️ ${boldLabel('User:')} ${displayUser(input.user)}`,
    `📟 ${boldLabel('UserID:')} ${escapeHtml(input.user.telegramId)}`,
    `⁉️ ${boldLabel('Reason:')} ${escapeHtml(REASON_LABELS[input.category])}`,
  ]

  if (input.orderId?.trim()) {
    lines.push(`📋 ${boldLabel('OrderNumber:')} ${escapeHtml(input.orderId.trim())}`)
  }

  return lines.join('\n')
}
