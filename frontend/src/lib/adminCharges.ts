import { apiFetch } from './api'
import type { CardChargeRequest, CardChargeStatus } from '../types/payments'

export type AdminChargesPayload = {
  version: string | null
  cachedAt: string
  status: CardChargeStatus | 'all'
  charges: CardChargeRequest[]
}

const storageKey = (status: CardChargeStatus | 'all') =>
  `panelout.admin.charges.${status}`

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function readLocalAdminCharges(
  status: CardChargeStatus | 'all',
): AdminChargesPayload | null {
  return readJson<AdminChargesPayload>(storageKey(status))
}

export function writeLocalAdminCharges(payload: AdminChargesPayload) {
  localStorage.setItem(storageKey(payload.status), JSON.stringify(payload))
}

function emptyPayload(status: CardChargeStatus | 'all'): AdminChargesPayload {
  return {
    version: null,
    cachedAt: new Date().toISOString(),
    status,
    charges: [],
  }
}

export async function fetchAdminChargesPayload(
  status: CardChargeStatus | 'all' = 'pending',
): Promise<AdminChargesPayload> {
  const data = await apiFetch<{
    ok: boolean
    version: string | null
    cachedAt: string
    status: CardChargeStatus | 'all'
    charges: CardChargeRequest[]
  }>(`/api/admin/charges?status=${encodeURIComponent(status)}`)

  return {
    version: data.version ?? null,
    cachedAt: data.cachedAt || new Date().toISOString(),
    status: data.status || status,
    charges: Array.isArray(data.charges) ? data.charges : [],
  }
}

export async function syncAdminCharges(
  status: CardChargeStatus | 'all',
  version?: string | null,
): Promise<AdminChargesPayload & { changed: boolean }> {
  const params = new URLSearchParams({ status })
  if (version) params.set('version', version)

  const data = await apiFetch<{
    ok: boolean
    changed: boolean
    version?: string | null
    cachedAt?: string
    status?: CardChargeStatus | 'all'
    charges?: CardChargeRequest[]
  }>(`/api/admin/charges/sync?${params.toString()}`)

  if (!data.changed) {
    const local = readLocalAdminCharges(status) ?? emptyPayload(status)
    return {
      ...local,
      version: data.version ?? local.version,
      changed: false,
    }
  }

  return {
    version: data.version ?? null,
    cachedAt: data.cachedAt || new Date().toISOString(),
    status: data.status || status,
    charges: Array.isArray(data.charges) ? data.charges : [],
    changed: true,
  }
}
