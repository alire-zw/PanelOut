import type { SupportTicketCategory, SupportTicketStatus } from '@prisma/client'
import { SUPPORT_CATEGORY_LABELS } from './support.schema.js'

export function ticketCodeFromId(id: number): string {
  return `T${10_000 + id}`
}

export function subjectFromCategory(category: SupportTicketCategory): string {
  return SUPPORT_CATEGORY_LABELS[category]
}

export function serializeTicketMessage(message: {
  id: number
  senderRole: string
  body: string
  imageData?: string | null
  createdAt: Date
}) {
  return {
    id: message.id,
    senderRole: message.senderRole,
    body: message.body,
    imageData: message.imageData ?? null,
    createdAt: message.createdAt.toISOString(),
  }
}

export function serializeTicketSummary(ticket: {
  id: number
  ticketCode: string
  category: SupportTicketCategory
  orderId: string | null
  subject: string
  status: SupportTicketStatus
  createdAt: Date
  updatedAt: Date
  messages?: Array<{ senderRole: string; body: string; createdAt: Date }>
}) {
  const last = ticket.messages?.[0]
  return {
    id: ticket.id,
    ticketCode: ticket.ticketCode,
    category: ticket.category,
    categoryLabel: SUPPORT_CATEGORY_LABELS[ticket.category],
    orderId: ticket.orderId,
    subject: ticket.subject,
    status: ticket.status,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    lastMessage: last
      ? {
          senderRole: last.senderRole,
          body: last.body,
          createdAt: last.createdAt.toISOString(),
        }
      : null,
  }
}
