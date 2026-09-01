import { apiFetch } from './api'
import type { PanelSubscription } from './panelApi'

export type OutboundSubscription = PanelSubscription & {
  connectionLink?: string | null
  volumeGb?: number
  isOutbound?: boolean
  isOutboundVolume?: boolean
  isOutboundUsage?: boolean
}

export type OutboundOptions = {
  pricing: {
    pricePerGb: number
    defaultVolumeGb: number
    maxVolumeGb: number
    usageMinBalanceGb: number
    usageMinBalanceIrt: number
    usageExistingCount: number
  }
  availability: {
    volume: boolean
    usage: boolean
  }
  user: {
    balance: number
    hasEnoughBalanceForUsage: boolean
  }
  subscriptions: OutboundSubscription[]
  canPurchaseVolume: boolean
  canActivateUsage: boolean
}

export type OutboundVolumeQuote = {
  volumeGb: number
  pricePerGb: number
  baseAmountIrt: number
  discountPercent: number
  amountIrt: number
}

export type OutboundCredentials = {
  connectionLink: string
  clientUsername: string
  volumeGb?: number
  amountIrt?: number
  discountPercent?: number
}

export type OutboundCredentialsState = {
  credentials: OutboundCredentials
  kind: 'volume' | 'usage'
}

export async function fetchOutboundOptions() {
  return apiFetch<{ ok: boolean } & OutboundOptions>('/api/outbound/options')
}

export async function fetchOutboundVolumeQuote(volumeGb: number) {
  return apiFetch<{ ok: boolean; quote: OutboundVolumeQuote }>(
    `/api/outbound/quote?volumeGb=${encodeURIComponent(String(volumeGb))}`,
  )
}

export async function purchaseOutboundVolume(volumeGb: number) {
  return apiFetch<{
    ok: boolean
    subscription: OutboundSubscription
    credentials: OutboundCredentials
    userBalance: number
  }>('/api/outbound/volume/purchase', {
    method: 'POST',
    body: JSON.stringify({ volumeGb }),
  })
}

export async function activateOutboundUsage() {
  return apiFetch<{
    ok: boolean
    subscription: OutboundSubscription
    credentials: OutboundCredentials
  }>('/api/outbound/usage/activate', {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export async function deactivateOutboundUsage(subscriptionId: string) {
  return apiFetch<{ ok: boolean; subscription: OutboundSubscription }>(
    `/api/outbound/usage/${subscriptionId}/deactivate`,
    { method: 'POST', body: JSON.stringify({}) },
  )
}

export async function toggleOutboundVolume(subscriptionId: string) {
  return apiFetch<{ ok: boolean; subscription: OutboundSubscription }>(
    `/api/outbound/${subscriptionId}/toggle`,
    { method: 'POST', body: JSON.stringify({}) },
  )
}

export async function fetchMyOutbound() {
  return apiFetch<{
    ok: boolean
    userBalance: number
    subscriptions: OutboundSubscription[]
    version?: string
    cachedAt?: string
  }>('/api/outbound/mine')
}
