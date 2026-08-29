import { apiFetch } from './api'

export type PasarGuardPanelStats = {
  totalUsers: number
  onlineUsers: number
  activeUsers: number
  incomingBandwidth: number
  outgoingBandwidth: number
  totalTraffic: number
  version: string | null
  uptime: number | null
  memory: { total: number; used: number } | null
  cpuCores: number | null
  adminCount?: number
}

export type PasarGuardPanel = {
  id: string
  name: string
  panelUrl: string
  host: string
  port: number
  adminUsername: string
  remark: string | null
  subPublicBaseUrl: string | null
  priority: number
  isActive: boolean
  salesEnabled: boolean
  renewalEnabled: boolean
  outboundVolumeEnabled: boolean
  outboundUsageEnabled: boolean
  panelVolumeEnabled: boolean
  panelUsageEnabled: boolean
  panelUnlimitedEnabled: boolean
  createdAt: string
  updatedAt: string
  hasPassword: boolean
  connection?: { ok: boolean; error: string | null }
  stats?: PasarGuardPanelStats | null
  statsError?: string | null
}

export type PasarGuardPanelDetail = {
  panel: PasarGuardPanel
  connection: { ok: boolean; error: string | null }
  stats: PasarGuardPanelStats | null
  statsError: string | null
}

export type CreatePasarGuardPanelInput = {
  name: string
  panelUrl: string
  adminUsername: string
  adminPassword: string
  remark?: string
  subPublicBaseUrl?: string
  priority?: number
}

export type UpdatePasarGuardPanelInput = Partial<
  CreatePasarGuardPanelInput & {
    isActive: boolean
    salesEnabled: boolean
    renewalEnabled: boolean
    outboundVolumeEnabled: boolean
    outboundUsageEnabled: boolean
    panelVolumeEnabled: boolean
    panelUsageEnabled: boolean
    panelUnlimitedEnabled: boolean
  }
>

export type PanelToggleKind =
  | 'active'
  | 'sales'
  | 'renewal'
  | 'outboundVolume'
  | 'outboundUsage'
  | 'panelVolume'
  | 'panelUsage'
  | 'panelUnlimited'

export async function fetchAdminPanels(options?: { connection?: boolean; stats?: boolean }) {
  const params = new URLSearchParams()
  if (options?.connection) params.set('connection', '1')
  if (options?.stats) params.set('stats', '1')
  const qs = params.toString()
  const data = await apiFetch<{ ok: boolean; items: PasarGuardPanel[] }>(
    `/api/admin/panels${qs ? `?${qs}` : ''}`,
  )
  return { items: data.items }
}

export async function fetchAdminPanelDetail(id: string) {
  const data = await apiFetch<{ ok: boolean } & PasarGuardPanelDetail>(
    `/api/admin/panels/${encodeURIComponent(id)}`,
  )
  return {
    panel: data.panel,
    connection: data.connection,
    stats: data.stats,
    statsError: data.statsError,
  }
}

export async function createAdminPanel(input: CreatePasarGuardPanelInput) {
  const data = await apiFetch<{ ok: boolean; panel: PasarGuardPanel }>('/api/admin/panels', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return data.panel
}

export async function updateAdminPanel(id: string, input: UpdatePasarGuardPanelInput) {
  const data = await apiFetch<{ ok: boolean; panel: PasarGuardPanel }>(
    `/api/admin/panels/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  )
  return data.panel
}

export async function deleteAdminPanel(id: string) {
  await apiFetch<{ ok: boolean }>(`/api/admin/panels/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export async function testAdminPanelConnection(id: string) {
  const data = await apiFetch<{ ok: boolean; connection: { ok: boolean; error: string | null } }>(
    `/api/admin/panels/${encodeURIComponent(id)}/test`,
    { method: 'POST' },
  )
  return data.connection
}

export async function toggleAdminPanelFlag(id: string, kind: PanelToggleKind) {
  const data = await apiFetch<{ ok: boolean; panel: PasarGuardPanel }>(
    `/api/admin/panels/${encodeURIComponent(id)}/toggle/${encodeURIComponent(kind)}`,
    { method: 'POST' },
  )
  return data.panel
}

export async function reorderAdminPanels(order: Array<{ id: string; priority: number }>) {
  const data = await apiFetch<{ ok: boolean; items: PasarGuardPanel[] }>(
    '/api/admin/panels/reorder',
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order }),
    },
  )
  return data.items
}
