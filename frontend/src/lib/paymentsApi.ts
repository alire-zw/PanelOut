import { apiFetch, getApiBaseUrl } from './api'
import type { BankCard, CardChargeRequest, CardChargeStatus } from '../types/payments'

type CardsResponse = { ok: boolean; cards: BankCard[] }
type ChargeResponse = { ok: boolean; charge: CardChargeRequest }
type ChargesResponse = { ok: boolean; charges: CardChargeRequest[] }

export function resolveUploadUrl(path: string) {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`
}

export async function fetchActivePaymentCards() {
  const data = await apiFetch<CardsResponse>('/api/payments/cards')
  return data.cards
}

export async function submitCardCharge(payload: {
  amount: number
  bankCardId: number
  receiptBase64?: string
  receiptMimeType?: string
  receiptPath?: string
}) {
  const data = await apiFetch<ChargeResponse>('/api/payments/card-charge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return data.charge
}

export type ReceiptUploadResult = {
  receiptPath: string
  receiptMime: string
  receiptUrl: string
  size: number
}

export function uploadReceiptWithProgress(
  payload: { receiptBase64: string; receiptMimeType: string },
  onProgress?: (percent: number) => void,
): Promise<ReceiptUploadResult> {
  return new Promise((resolve, reject) => {
    const initData = window.Telegram?.WebApp?.initData?.trim() || ''
    if (!initData) {
      reject(new Error('Telegram init data is missing'))
      return
    }

    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${getApiBaseUrl()}/api/payments/receipt-upload`)
    xhr.setRequestHeader('Accept', 'application/json')
    xhr.setRequestHeader('Content-Type', 'application/json')
    xhr.setRequestHeader('Authorization', `tma ${initData}`)

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return
      const percent = Math.max(0, Math.min(99, Math.round((event.loaded / event.total) * 100)))
      onProgress?.(percent)
    }

    xhr.onload = () => {
      let payloadBody: unknown = null
      try {
        payloadBody = JSON.parse(xhr.responseText || '{}')
      } catch {
        payloadBody = null
      }
      const body =
        payloadBody && typeof payloadBody === 'object'
          ? (payloadBody as Record<string, unknown>)
          : null

      if (xhr.status < 200 || xhr.status >= 300) {
        const message =
          body && typeof body.error === 'string'
            ? body.error
            : `آپلود ناموفق بود (${xhr.status})`
        reject(new Error(message))
        return
      }

      const receipt = body?.receipt as ReceiptUploadResult | undefined
      if (!receipt?.receiptPath) {
        reject(new Error('پاسخ آپلود نامعتبر است'))
        return
      }
      onProgress?.(100)
      resolve(receipt)
    }

    xhr.onerror = () => reject(new Error('خطا در ارتباط با سرور'))
    xhr.send(JSON.stringify(payload))
  })
}

export async function fetchMyCardCharges() {
  const data = await apiFetch<ChargesResponse>('/api/payments/card-charges/me')
  return data.charges
}

export async function fetchAdminCards() {
  const data = await apiFetch<CardsResponse>('/api/admin/cards')
  return data.cards
}

export async function createAdminCard(payload: {
  cardNumber: string
  sheba?: string | null
  holderName: string
}) {
  const data = await apiFetch<{ ok: boolean; card: BankCard }>('/api/admin/cards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return data.card
}

export async function updateAdminCard(
  id: number,
  payload: Partial<{
    cardNumber: string
    sheba: string | null
    holderName: string
    isActive: boolean
  }>,
) {
  const data = await apiFetch<{ ok: boolean; card: BankCard }>(`/api/admin/cards/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return data.card
}

export async function deleteAdminCard(id: number) {
  const data = await apiFetch<{ ok: boolean; card: BankCard }>(`/api/admin/cards/${id}`, {
    method: 'DELETE',
  })
  return data.card
}

export async function fetchAdminCharges(status: CardChargeStatus | 'all' = 'pending') {
  const data = await apiFetch<{
    ok: boolean
    charges: CardChargeRequest[]
    version?: string | null
    cachedAt?: string
    status?: CardChargeStatus | 'all'
  }>(`/api/admin/charges?status=${status}`)
  return data.charges
}

export async function approveAdminCharge(id: number) {
  const data = await apiFetch<ChargeResponse>(`/api/admin/charges/${id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })
  return data.charge
}

export async function rejectAdminCharge(id: number, note?: string) {
  const data = await apiFetch<ChargeResponse>(`/api/admin/charges/${id}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note: note ?? null }),
  })
  return data.charge
}

export function formatCardNumberDisplay(cardNumber: string) {
  const digits = cardNumber.replace(/\D/g, '')
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim()
}

export function formatShebaDisplay(sheba: string) {
  return sheba.replace(/(.{4})/g, '$1 ').trim()
}

export type AdminOverview = {
  usersCount: number
  pendingCharges: number
  activeCards: number
  openTickets: number
}

export async function fetchAdminOverview() {
  const data = await apiFetch<{ ok: boolean; overview: AdminOverview }>('/api/admin/overview')
  return data.overview
}

export async function fetchAdminUsers(query = '') {
  const q = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''
  const data = await apiFetch<{ ok: boolean; users: import('../types/user').AppUser[] }>(
    `/api/admin/users${q}`,
  )
  return data.users
}

export async function fetchAdminUser(telegramId: number) {
  const data = await apiFetch<{ ok: boolean; user: import('../types/user').AppUser }>(
    `/api/admin/users/${telegramId}`,
  )
  return data.user
}
