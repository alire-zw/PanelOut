import type { SupportTicketCategory } from '@prisma/client'
import { SUPPORT_CATEGORY_LABELS } from '../../support/support.schema.js'
import { PAYMENT_SUCCESS_EMOJI, tgPremiumEmoji } from './premium-emoji.js'

interface SupportTicketCreatedMessageInput {
  ticketCode: string
  category: SupportTicketCategory
  orderId?: string | null
}

export function buildSupportTicketCreatedMessage(
  input: SupportTicketCreatedMessageInput,
): string {
  const { check, briefcase, receipt, heart } = PAYMENT_SUCCESS_EMOJI
  const categoryLabel = SUPPORT_CATEGORY_LABELS[input.category]
  const lines = [
    `${tgPremiumEmoji(check.fallback, check.id)} <b>تیکت پشتیبانی شما ثبت شد.</b>`,
    `${tgPremiumEmoji(briefcase.fallback, briefcase.id)} موضوع: <b>${categoryLabel}</b>`,
    `${tgPremiumEmoji(receipt.fallback, receipt.id)} شناسه تیکت: <code>${input.ticketCode}</code>`,
  ]
  if (input.orderId) {
    lines.push(
      `${tgPremiumEmoji(receipt.fallback, receipt.id)} سفارش مرتبط: <code>${input.orderId}</code>`,
    )
  }
  lines.push(
    `${tgPremiumEmoji(heart.fallback, heart.id)} تیم پشتیبانی در اسرع وقت پاسخ می‌دهد. می‌توانید از دکمه زیر گفتگو را دنبال کنید.`,
  )
  return lines.join('\n\n')
}
