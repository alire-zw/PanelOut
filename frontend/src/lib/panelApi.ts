import { apiFetch } from './api'

export type PanelLiveStats = {
  available: boolean
  totalUsers: number | null
  maxUsers: number | null
  usedTrafficBytes: string
  usedTrafficGb: string
  remainingTrafficBytes: string
  remainingTrafficGb: string
  capacityTrafficBytes: string
  capacityTrafficGb: string
  usedPercent: number
  capacityMode: 'wallet' | 'trial' | 'prepaid' | 'volume'
  adminEnabled: boolean | null
}

export type PanelSubscription = {
  id: string
  panelId: string
  serviceType:
    | 'panel_trial'
    | 'panel_usage'
    | 'panel_unlimited'
    | 'panel_reseller'
    | 'outbound_volume'
    | 'outbound_usage'
  clientUsername: string
  panelUrl: string
  connectionLink?: string | null
  volumeGb?: number
  adminPassword?: string | null
  status: string
  paymentMethod: string | null
  walletBalance?: number
  createdAt: string
  hasPassword?: boolean
  isReseller?: boolean
  isPersonal?: boolean
  isTrial?: boolean
  isOutbound?: boolean
  isOutboundVolume?: boolean
  isOutboundUsage?: boolean
  billingWallet?: 'panel' | 'main'
  displayWalletBalance?: number
  usagePricePerGb?: number
  trialVolumeGb?: number | null
  live?: PanelLiveStats
  totalUsers?: number | null
  usedTrafficGb?: string
  remainingTrafficGb?: string
  capacityTrafficGb?: string
  usedPercent?: number
  capacityMode?: 'wallet' | 'trial' | 'prepaid' | 'volume'
  prepaidTrafficGb?: string | null
}

export type PanelOptions = {
  pricing: {
    trialVolumeGb: number
    usageMinBalanceGb: number
    usagePricePerGb: number
    usageMinBalanceIrt: number
    outboundPricePerGb?: number
  }
  availability: { trial: boolean; usage: boolean; reseller?: boolean }
  user: {
    balance: number
    hasEnoughBalanceForUsage: boolean
    panelAdminPassword?: string | null
    hasClaimedTrial?: boolean
  }
  subscriptions: {
    trial: PanelSubscription | null
    usage: PanelSubscription | null
    resellers?: PanelSubscription[]
  }
  canClaimTrial: boolean
  canActivateUsage: boolean
  canUpgradeTrialToUsage: boolean
  canActivateReseller?: boolean
  canImportExisting?: boolean
}

export type PanelCredentials = {
  username: string
  password: string | null
  panelUrl: string
  volumeGb?: number
  upgradedFromTrial?: boolean
  isReseller?: boolean
  prepaidGb?: number
  usedTrafficGb?: number
  imported?: boolean
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

export async function fetchMyPanels() {
  const data = await apiFetch<{
    ok: boolean
    userBalance: number
    panels: PanelSubscription[]
  }>('/api/panel/mine')
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

export async function activatePanelUsage(params?: {
  username?: string
  mode?: 'upgrade' | 'new'
}) {
  const payload: Record<string, unknown> = {}
  if (params?.username) payload.username = params.username
  if (params?.mode) payload.mode = params.mode

  const data = await apiFetch<{
    ok: boolean
    subscription: PanelSubscription
    credentials: PanelCredentials
  }>('/api/panel/usage/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return data
}

export async function activatePanelReseller(username: string) {
  const data = await apiFetch<{
    ok: boolean
    subscription: PanelSubscription
    credentials: PanelCredentials
  }>('/api/panel/reseller/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  })
  return data
}

export async function previewExistingPanel(params: {
  username: string
  password: string
  kind: 'usage' | 'reseller'
}) {
  return apiFetch<{
    ok: boolean
    username: string
    prepaidGb: number
    usedTrafficGb: number
    isReseller: boolean
  }>('/api/panel/import/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
}

export async function importExistingPanel(params: {
  username: string
  password: string
  kind: 'usage' | 'reseller'
}) {
  const data = await apiFetch<{
    ok: boolean
    subscription: PanelSubscription
    credentials: PanelCredentials
  }>('/api/panel/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  return data
}

export async function allocatePanelBalance(
  subscriptionId: string,
  amount: number,
  action: 'increase' | 'decrease' = 'increase',
) {
  const data = await apiFetch<{
    ok: boolean
    subscription: PanelSubscription
    userBalance: number
    allocated: number
    withdrawn?: number
    action: 'increase' | 'decrease'
  }>(`/api/panel/${subscriptionId}/allocate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, action }),
  })
  return data
}

export async function togglePanelSubscription(
  subscriptionId: string,
  action: 'suspend' | 'reactivate',
) {
  const data = await apiFetch<{
    ok: boolean
    subscriptionId: string
    status: string
  }>(`/api/panel/${subscriptionId}/${action}`, {
    method: 'POST',
  })
  return data
}

export async function resetPanelPassword(subscriptionId: string) {
  const data = await apiFetch<{
    ok: boolean
    subscriptionId: string
    password: string
    clientUsername: string
  }>(`/api/panel/${subscriptionId}/reset-password`, {
    method: 'POST',
  })
  return data
}
