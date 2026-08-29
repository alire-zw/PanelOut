import { apiFetch } from './api'

export type PanelSubscription = {
  id: string
  panelId: string
  serviceType: 'panel_trial' | 'panel_usage' | 'panel_unlimited'
  clientUsername: string
  panelUrl: string
  status: string
  paymentMethod: string | null
  createdAt: string
  hasPassword?: boolean
}

export type PanelOptions = {
  pricing: {
    trialVolumeGb: number
    usageMinBalanceGb: number
    usagePricePerGb: number
    usageMinBalanceIrt: number
  }
  availability: { trial: boolean; usage: boolean }
  user: { balance: number; hasEnoughBalanceForUsage: boolean }
  subscriptions: { trial: PanelSubscription | null; usage: PanelSubscription | null }
  canClaimTrial: boolean
  canActivateUsage: boolean
  canUpgradeTrialToUsage: boolean
}

export type PanelCredentials = {
  username: string
  password: string | null
  panelUrl: string
  volumeGb?: number
  upgradedFromTrial?: boolean
}

export type PanelUsernameCheckResult = {
  ok: boolean
  available: boolean
  reason?: string
  message?: string
  username: string
}

export async function checkPanelUsername(username: string): Promise<PanelUsernameCheckResult> {
  return apiFetch<PanelUsernameCheckResult>(
    `/api/panel/check-username?username=${encodeURIComponent(username.trim())}`,
  )
}

export async function fetchPanelOptions() {
  const data = await apiFetch<{ ok: boolean } & PanelOptions>('/api/panel/options')
  return data
}

export async function activatePanelTrial(username: string) {
  const data = await apiFetch<{
    ok: boolean
    subscription: PanelSubscription
    credentials: PanelCredentials
  }>('/api/panel/trial', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  })
  return data
}

export async function activatePanelUsage(username?: string) {
  const data = await apiFetch<{
    ok: boolean
    subscription: PanelSubscription
    credentials: PanelCredentials
  }>('/api/panel/usage/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(username ? { username } : {}),
  })
  return data
}
