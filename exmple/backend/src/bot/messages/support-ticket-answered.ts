import type { SupportTicketCategory } from '@prisma/client'
import { SUPPORT_CATEGORY_LABELS } from '../../support/support.schema.js'
import { PAYMENT_SUCCESS_EMOJI, tgPremiumEmoji } from './premium-emoji.js'

interface SupportTicketAnsweredMessageInput {
  ticketCode: string
  category: SupportTicketCategory
  preview: string
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

export function buildSupportTicketAnsweredMessage(
  input: SupportTicketAnsweredMessageInput,
): string {
  const { check, briefcase, receipt, plane, heart } = PAYMENT_SUCCESS_EMOJI
  const categoryLabel = SUPPORT_CATEGORY_LABELS[input.category]
  const preview = escapeHtml(input.preview.trim())

  return [
    `${tgPremiumEmoji(check.fallback, check.id)} <b>تیکت شما پاسخ داده شد.</b>`,
    `${tgPremiumEmoji(briefcase.fallback, briefcase.id)} موضوع: <b>${categoryLabel}</b>`,
    `${tgPremiumEmoji(receipt.fallback, receipt.id)} شناسه تیکت: <code>${input.ticketCode}</code>`,
    `${tgPremiumEmoji(plane.fallback, plane.id)} خلاصه پاسخ: ${preview}${input.preview.length > 120 ? '…' : ''}`,
    `${tgPremiumEmoji(heart.fallback, heart.id)} برای ادامه گفتگو دکمه زیر را بزنید.`,
  ].join('\n\n')
}
