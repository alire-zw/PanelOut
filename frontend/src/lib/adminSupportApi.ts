import { apiFetch } from './api'
import type { SupportCategory, SupportTicketMessage, SupportTicketStatus } from './supportApi'

export type AdminTicketListItem = {
  id: number
  ticketCode: string
  category: string
  categoryLabel: string
  orderId: string | null
  subject: string
  status: SupportTicketStatus | string
  createdAt: string
  updatedAt: string
  user: {
    id: number
    telegramId: string
    username: string | null
    firstName: string | null
    lastName: string | null
    realName?: string | null
  }
  lastMessage: {
    senderRole: string
    body: string
    createdAt: string
  } | null
}

export type AdminTicketDetail = {
  id: number
  ticketCode: string
  category: string
  categoryLabel: string
  orderId: string | null
  subject: string
  status: SupportTicketStatus | string
  createdAt: string
  updatedAt: string
  user: AdminTicketListItem['user']
  order: null | {
    orderId: string
    status: string
    amountToman: string
    category: { slug: string; label: string }
  }
  messages: SupportTicketMessage[]
}

export async function fetchAdminTickets(params: {
  page?: number
  limit?: number
  status?: string
  category?: string
  search?: string
}) {
  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  if (params.limit) query.set('limit', String(params.limit))
  if (params.status) query.set('status', params.status)
  if (params.category) query.set('category', params.category)
  if (params.search) query.set('search', params.search)
  const qs = query.toString()
  const data = await apiFetch<{
    ok: boolean
    total: number
    page: number
    limit: number
    totalPages: number
    items: AdminTicketListItem[]
  }>(`/api/admin/tickets${qs ? `?${qs}` : ''}`)
  return data
}

export async function fetchAdminTicket(id: number) {
  const data = await apiFetch<{ ok: boolean; ticket: AdminTicketDetail }>(
    `/api/admin/tickets/${id}`,
  )
  return data
}

export async function replyAdminTicket(
  id: number,
  payload: { body: string; status?: 'open' | 'answered' | 'closed' },
) {
  const data = await apiFetch<{ ok: boolean; ticket: AdminTicketDetail }>(
    `/api/admin/tickets/${id}/reply`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  )
  return data
}

export async function fetchSupportContactSetting() {
  const data = await apiFetch<{ ok: boolean; telegramUsername: string | null }>(
    '/api/admin/settings/support-contact',
  )
  return data.telegramUsername
}

export async function updateSupportContactSetting(telegramUsername: string) {
  const data = await apiFetch<{ ok: boolean; telegramUsername: string | null }>(
    '/api/admin/settings/support-contact',
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramUsername }),
    },
  )
  return data.telegramUsername
}

export type { SupportCategory }
