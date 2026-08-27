import { apiFetch } from './api'

export type SupportTicketStatus = 'open' | 'answered' | 'closed'
export type SupportCategory = 'sales' | 'product' | 'wallet' | 'other'

export type SupportTicketSummary = {
  id: number
  ticketCode: string
  category: SupportCategory | string
  categoryLabel: string
  orderId: string | null
  subject: string
  status: SupportTicketStatus
  createdAt: string
  updatedAt: string
  lastMessage: {
    senderRole: string
    body: string
    createdAt: string
  } | null
}

export type SupportTicketMessage = {
  id: number
  senderRole: 'user' | 'admin' | string
  body: string
  imageData?: string | null
  createdAt: string
}

export type SupportTicketDetail = SupportTicketSummary & {
  order: {
    orderId: string
    status: string
    amountToman: string
    category: { slug: string; label: string }
  } | null
  messages: SupportTicketMessage[]
}

export type SupportTicketsPayload = {
  version: string | null
  cachedAt: string
  items: SupportTicketSummary[]
}

export type SupportTicketDetailPayload = {
  version: string | null
  cachedAt: string
  ticket: SupportTicketDetail
}

export type SupportContact = {
  telegramUsername: string | null
  telegramUrl: string | null
}

export type SupportOrderItem = {
  orderId: string
  status: string
  amountToman: string
  category: { slug: string; label: string }
  createdAt: string
}

export const SUPPORT_CATEGORIES: Array<{
  value: SupportCategory
  label: string
  hint: string
  suggestOrder: boolean
}> = [
  {
    value: 'sales',
    label: 'واحد فروش',
    hint: 'خرید، قیمت و پلن',
    suggestOrder: false,
  },
  {
    value: 'product',
    label: 'پشتیبانی محصول',
    hint: 'سرویس، کانفیگ و اتصال',
    suggestOrder: true,
  },
  {
    value: 'wallet',
    label: 'کیف پول و پرداخت',
    hint: 'شارژ، رسید و انتقال',
    suggestOrder: false,
  },
  {
    value: 'other',
    label: 'سایر',
    hint: 'موارد دیگر',
    suggestOrder: false,
  },
]

const TICKETS_KEY = 'panelout.support.tickets'
const CONTACT_KEY = 'panelout.support.contact'
const DETAIL_KEY = (code: string) => `panelout.support.ticket.${code}`

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function supportStatusLabel(status: SupportTicketStatus | string): string {
  switch (status) {
    case 'answered':
      return 'پاسخ‌خورده'
    case 'closed':
      return 'بسته‌شده'
    default:
      return 'باز'
  }
}

export function supportTicketTitle(ticketCode: string): string {
  return `تیکت ${ticketCode}`
}

export function readLocalSupportTickets(): SupportTicketsPayload | null {
  return readJson<SupportTicketsPayload>(TICKETS_KEY)
}

export function writeLocalSupportTickets(payload: SupportTicketsPayload) {
  localStorage.setItem(TICKETS_KEY, JSON.stringify(payload))
}

export function readLocalSupportContact(): SupportContact | null {
  return readJson<SupportContact>(CONTACT_KEY)
}

export function writeLocalSupportContact(contact: SupportContact) {
  localStorage.setItem(CONTACT_KEY, JSON.stringify(contact))
}

export function readLocalSupportTicket(ticketCode: string): SupportTicketDetailPayload | null {
  return readJson<SupportTicketDetailPayload>(DETAIL_KEY(ticketCode))
}

export function writeLocalSupportTicket(payload: SupportTicketDetailPayload) {
  localStorage.setItem(DETAIL_KEY(payload.ticket.ticketCode), JSON.stringify(payload))
}

export async function fetchSupportTickets(): Promise<SupportTicketsPayload> {
  const data = await apiFetch<{
    ok: boolean
    version: string
    cachedAt: string
    items: SupportTicketSummary[]
  }>('/api/support/tickets')
  return {
    version: data.version,
    cachedAt: data.cachedAt,
    items: data.items,
  }
}

export async function syncSupportTickets(
  version?: string,
): Promise<SupportTicketsPayload & { changed: boolean }> {
  const data = await apiFetch<{
    ok: boolean
    changed: boolean
    version: string
    cachedAt: string
    items: SupportTicketSummary[]
  }>('/api/support/tickets/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version }),
  })
  return {
    changed: data.changed,
    version: data.version,
    cachedAt: data.cachedAt,
    items: data.items,
  }
}

export async function fetchSupportContact(): Promise<SupportContact> {
  const data = await apiFetch<{
    ok: boolean
    telegramUsername: string | null
    telegramUrl: string | null
  }>('/api/support/contact')
  return {
    telegramUsername: data.telegramUsername,
    telegramUrl: data.telegramUrl,
  }
}

export async function fetchSupportOrders(): Promise<{ items: SupportOrderItem[] }> {
  const data = await apiFetch<{ ok: boolean; items: SupportOrderItem[] }>(
    '/api/support/orders',
  )
  return { items: data.items ?? [] }
}

export async function fetchSupportTicket(
  idOrCode: string,
): Promise<SupportTicketDetailPayload> {
  const data = await apiFetch<{
    ok: boolean
    version: string
    cachedAt: string
    ticket: SupportTicketDetail
  }>(`/api/support/tickets/${encodeURIComponent(idOrCode)}`)
  return {
    version: data.version,
    cachedAt: data.cachedAt,
    ticket: data.ticket,
  }
}

export async function syncSupportTicket(
  idOrCode: string,
  version?: string,
): Promise<SupportTicketDetailPayload & { changed: boolean }> {
  const data = await apiFetch<{
    ok: boolean
    changed: boolean
    version: string
    cachedAt: string
    ticket: SupportTicketDetail
  }>(`/api/support/tickets/${encodeURIComponent(idOrCode)}/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version }),
  })
  return {
    changed: data.changed,
    version: data.version,
    cachedAt: data.cachedAt,
    ticket: data.ticket,
  }
}

export async function createSupportTicket(payload: {
  category: SupportCategory
  body?: string
  orderId?: string
  imageData?: string
}): Promise<SupportTicketDetailPayload> {
  const data = await apiFetch<{
    ok: boolean
    version: string
    cachedAt: string
    ticket: SupportTicketDetail
  }>('/api/support/tickets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return {
    version: data.version,
    cachedAt: data.cachedAt,
    ticket: data.ticket,
  }
}

export async function replySupportTicket(
  idOrCode: string,
  payload: { body?: string; imageData?: string },
): Promise<SupportTicketDetailPayload> {
  const data = await apiFetch<{
    ok: boolean
    version: string
    cachedAt: string
    ticket: SupportTicketDetail
  }>(`/api/support/tickets/${encodeURIComponent(idOrCode)}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return {
    version: data.version,
    cachedAt: data.cachedAt,
    ticket: data.ticket,
  }
}

/** Compress / resize image for ticket attachment (data URL). */
export async function compressSupportImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('فقط فایل تصویری مجاز است')
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error('حجم تصویر زیاد است')
  }

  const bitmap = await createImageBitmap(file)
  const maxSide = 1280
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('فشرده‌سازی تصویر ناموفق بود')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const qualitySteps = [0.82, 0.7, 0.58, 0.45]
  for (const quality of qualitySteps) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality)
    if (dataUrl.length < 700_000) return dataUrl
  }
  const fallback = canvas.toDataURL('image/jpeg', 0.35)
  if (fallback.length > 900_000) {
    throw new Error('تصویر بعد از فشرده‌سازی هنوز بزرگ است')
  }
  return fallback
}
