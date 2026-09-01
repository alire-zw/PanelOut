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

export type AdminOverviewToday = {
  usageTrafficBytes: string
  usageAmountIrt: number
  usageUsersCount: number
  usageBillingCount: number
  chargesAmountIrt: number
  chargesCount: number
  chargesUsersCount: number
  cardChargesAmountIrt: number
  tronChargesAmountIrt: number
}

export type AdminOverview = {
  usersCount: number
  pendingCharges: number
  activeCards: number
  openTickets: number
  today: AdminOverviewToday
}

export type PaymentMethods = {
  tron: boolean
  card: boolean
}

export type TronDepositInfo = {
  address: string
  trxPriceIrt: number
  amountToman: number | null
  suggestedTrx: number | null
}

export type TronTransactionDetail = {
  id: number
  txHash: string
  amountTrx: string
  amountIrt: number
  trxPriceIrt: number
  explorerUrl: string
  createdAt: string | null
  blockTimestamp: string | null
}

export type PaymentSettings = {
  tronEnabled: boolean
  masterWalletAddress: string | null
  tronConfigured: boolean
  updatedBy: number | null
  dateUpdated: string | null
}

export async function fetchPaymentMethods() {
  const data = await apiFetch<{ ok: boolean; methods: PaymentMethods }>(
    '/api/payments/methods',
  )
  return data.methods
}

export async function fetchTronDeposit(amount?: number) {
  const query = amount && amount > 0 ? `?amount=${encodeURIComponent(String(amount))}` : ''
  const data = await apiFetch<{ ok: boolean; deposit: TronDepositInfo }>(
    `/api/payments/tron/deposit${query}`,
  )
  return data.deposit
}

export async function fetchTronTransaction(id: number) {
  const data = await apiFetch<{ ok: boolean; transaction: TronTransactionDetail }>(
    `/api/payments/tron/transactions/${id}`,
  )
  return data.transaction
}

export async function fetchAdminPaymentSettings() {
  const data = await apiFetch<{ ok: boolean; settings: PaymentSettings }>(
    '/api/admin/payment-settings',
  )
  return data.settings
}

export async function updateAdminPaymentSettings(payload: {
  tronEnabled?: boolean
  masterWalletAddress?: string | null
}) {
  const data = await apiFetch<{ ok: boolean; settings: PaymentSettings }>(
    '/api/admin/payment-settings',
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  )
  return data.settings
}

export async function fetchAdminOverview() {
  const data = await apiFetch<{ ok: boolean; overview: AdminOverview }>('/api/admin/overview')
  return data.overview
}

export type UsageInvoiceRange = 'today' | 'week' | 'month' | 'all'

export type AdminUsageInvoiceSummary = {
  invoiceCount: number
  usersCount: number
  amountIrt: number
  trafficBytes: string
}

export type AdminUsageInvoiceServiceRow = {
  serviceType: string
  invoiceCount: number
  amountIrt: number
  trafficBytes: string
}

export type AdminUsageInvoiceUserRow = {
  telegramUserId: number
  displayName: string
  username: string | null
  invoiceCount: number
  amountIrt: number
  trafficBytes: string
}

export type AdminUsageInvoicePanelRow = {
  clientUsername: string
  serviceType: string
  telegramUserId: number
  ownerDisplayName: string
  invoiceCount: number
  amountIrt: number
  trafficBytes: string
}

export type AdminUsageInvoiceItem = {
  id: number
  source?: 'panel' | 'outbound'
  subscriptionId: number
  telegramUserId: number
  clientUsername: string
  serviceType: string
  trafficBytes: string
  amountIrt: number
  trafficAfterBytes: string
  walletSource: 'main' | 'panel'
  createdAt: string | null
  userDisplayName: string
  username: string | null
}

export type AdminUsageInvoicesPayload = {
  range: UsageInvoiceRange
  summary: AdminUsageInvoiceSummary
  byServiceType: AdminUsageInvoiceServiceRow[]
  topUsers: AdminUsageInvoiceUserRow[]
  topPanels: AdminUsageInvoicePanelRow[]
  items: AdminUsageInvoiceItem[]
  pagination: {
    limit: number
    offset: number
    total: number
    hasMore: boolean
  }
}

export async function fetchAdminUsageInvoices(params: {
  range?: UsageInvoiceRange
  limit?: number
  offset?: number
} = {}) {
  const search = new URLSearchParams()
  if (params.range) search.set('range', params.range)
  if (params.limit != null) search.set('limit', String(params.limit))
  if (params.offset != null) search.set('offset', String(params.offset))
  const query = search.toString()
  const data = await apiFetch<{ ok: boolean } & AdminUsageInvoicesPayload>(
    `/api/admin/usage-invoices${query ? `?${query}` : ''}`,
  )
  return data
}

export async function fetchAdminUsers(query = '') {
  const q = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''
  const data = await apiFetch<{ ok: boolean; users: import('../types/user').AppUser[] }>(
    `/api/admin/users${q}`,
  )
  return data.users
}

export type SubscriptionPricing = {
  panelUsagePricePerGb: number
  outboundPricePerGb: number
  panelUnlimitedPricePerSub: number
  panelUnlimitedPricePerUser: number
  updatedBy: number | null
  dateUpdated: string | null
}

export async function fetchAdminPricingSettings() {
  const data = await apiFetch<{ ok: boolean; pricing: SubscriptionPricing }>(
    '/api/admin/pricing-settings',
  )
  return data.pricing
}

export async function updateAdminPricingSettings(
  payload: Partial<{
    panelUsagePricePerGb: number
    outboundPricePerGb: number
    panelUnlimitedPricePerSub: number
    panelUnlimitedPricePerUser: number
  }>,
) {
  const data = await apiFetch<{ ok: boolean; pricing: SubscriptionPricing }>(
    '/api/admin/pricing-settings',
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  )
  return data.pricing
}

export async function fetchShopPricing() {
  const data = await apiFetch<{ ok: boolean; pricing: SubscriptionPricing }>(
    '/api/shop/pricing',
  )
  return data.pricing
}

export async function fetchAdminUser(telegramId: number) {
  const data = await apiFetch<{ ok: boolean; user: import('../types/user').AppUser }>(
    `/api/admin/users/${telegramId}`,
  )
  return data.user
}

export type AdminUserPanel = {
  id: string
  panelId: string
  serviceType: string
  clientUsername: string
  adminPassword: string | null
  panelAdminId: string | null
  panelUrl: string
  status: 'active' | 'suspended' | 'deactivated'
  paymentMethod: string | null
  walletBalance: number
  lastBilledTrafficBytes: string
  prepaidTrafficBytes: string
  lastBilledAt: string | null
  createdAt: string
  updatedAt: string
}

export type AdminUserDetailUser = import('../types/user').AppUser & {
  panelAdminPassword?: string | null
}

export type AdminAuditLog = {
  id: string
  action: string
  targetType: string | null
  targetId: string | null
  meta: Record<string, unknown> | null
  ip: string | null
  createdAt: string
  actor: {
    telegramId: number
    role: string
    username: string | null
    displayName: string | null
  }
}

export type AdminUserDetail = {
  user: AdminUserDetailUser
  panels: AdminUserPanel[]
  transactions: import('../types/wallet').WalletTransaction[]
  auditLogs: AdminAuditLog[]
}

export async function fetchAdminUserDetail(telegramId: number) {
  const data = await apiFetch<{ ok: boolean } & AdminUserDetail>(
    `/api/admin/users/${telegramId}/detail`,
  )
  return {
    user: data.user,
    panels: data.panels,
    transactions: data.transactions,
    auditLogs: data.auditLogs,
  }
}

export async function patchAdminUserBan(telegramId: number, isBanned: boolean) {
  const data = await apiFetch<{ ok: boolean; user: import('../types/user').AppUser }>(
    `/api/admin/users/${telegramId}/ban`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isBanned }),
    },
  )
  return data.user
}

export async function patchAdminUserBalance(
  telegramId: number,
  balanceToman: number,
  note?: string,
) {
  const data = await apiFetch<{
    ok: boolean
    user: import('../types/user').AppUser
    previousBalance: number
    newBalance: number
  }>(`/api/admin/users/${telegramId}/balance`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ balanceToman, note: note?.trim() || undefined }),
  })
  return data
}

export async function patchAdminUserPanelStatus(
  telegramId: number,
  subscriptionId: string,
  status: AdminUserPanel['status'],
) {
  const data = await apiFetch<{ ok: boolean; panel: AdminUserPanel }>(
    `/api/admin/users/${telegramId}/panels/${subscriptionId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    },
  )
  return data.panel
}

export async function patchAdminUserRole(telegramId: number, role: import('../types/user').UserRole) {
  const data = await apiFetch<{
    ok: boolean
    user: import('../types/user').AppUser
    previousRole: import('../types/user').UserRole
    newRole: import('../types/user').UserRole
  }>(`/api/admin/users/${telegramId}/role`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  })
  return data
}
