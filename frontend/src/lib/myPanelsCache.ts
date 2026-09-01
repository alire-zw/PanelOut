import { apiFetch } from './api'
import type { PanelSubscription } from './panelApi'

export type MyPanelsPayload = {
  version: string | null
  cachedAt: string
  userBalance: number
  usagePricePerGb?: number
  panels: PanelSubscription[]
  liveSyncedAt?: string | null
}

const STORAGE_KEY = 'panelout.my.panels'

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function readLocalMyPanels(): MyPanelsPayload | null {
  return readJson<MyPanelsPayload>(STORAGE_KEY)
}

export function writeLocalMyPanels(payload: MyPanelsPayload) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

function emptyPayload(): MyPanelsPayload {
  return {
    version: null,
    cachedAt: new Date().toISOString(),
    userBalance: 0,
    panels: [],
  }
}

export async function fetchMyPanelsCached(): Promise<MyPanelsPayload> {
  const data = await apiFetch<{
    ok: boolean
    version?: string | null
    cachedAt?: string
    userBalance: number
    usagePricePerGb?: number
    panels: PanelSubscription[]
    liveSyncedAt?: string | null
  }>('/api/panel/mine')

  return {
    version: data.version ?? null,
    cachedAt: data.cachedAt || new Date().toISOString(),
    userBalance: Number(data.userBalance) || 0,
    usagePricePerGb: data.usagePricePerGb,
    panels: Array.isArray(data.panels) ? data.panels : [],
    liveSyncedAt: data.liveSyncedAt ?? null,
  }
}

export async function syncMyPanels(
  version?: string,
): Promise<MyPanelsPayload & { changed: boolean }> {
  const q = version ? `?version=${encodeURIComponent(version)}` : ''
  const data = await apiFetch<{
    ok: boolean
    changed: boolean
    version?: string | null
    cachedAt?: string
    userBalance?: number
    usagePricePerGb?: number
    panels?: PanelSubscription[]
    liveSyncedAt?: string | null
  }>(`/api/panel/mine/sync${q}`)

  if (!data.changed) {
    const local = readLocalMyPanels() ?? emptyPayload()
    return {
      ...local,
      version: data.version ?? local.version,
      changed: false,
    }
  }

  return {
    version: data.version ?? null,
    cachedAt: data.cachedAt || new Date().toISOString(),
    userBalance: Number(data.userBalance) || 0,
    usagePricePerGb: data.usagePricePerGb,
    panels: Array.isArray(data.panels) ? data.panels : [],
    liveSyncedAt: data.liveSyncedAt ?? null,
    changed: true,
  }
}
