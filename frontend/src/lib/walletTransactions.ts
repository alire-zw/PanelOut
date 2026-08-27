import { apiFetch } from './api'
import type { WalletTransaction } from '../types/wallet'

export type WalletTransactionsPayload = {
  version: string | null
  cachedAt: string
  items: WalletTransaction[]
}

const STORAGE_KEY = 'panelout.wallet.transactions'

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function readLocalWalletTransactions(): WalletTransactionsPayload | null {
  return readJson<WalletTransactionsPayload>(STORAGE_KEY)
}

export function writeLocalWalletTransactions(payload: WalletTransactionsPayload) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

function emptyPayload(): WalletTransactionsPayload {
  return {
    version: null,
    cachedAt: new Date().toISOString(),
    items: [],
  }
}

export async function fetchWalletTransactions(): Promise<WalletTransactionsPayload> {
  const data = await apiFetch<{
    ok: boolean
    version: string | null
    cachedAt: string
    items: WalletTransaction[]
  }>('/api/wallet/transactions')

  return {
    version: data.version ?? null,
    cachedAt: data.cachedAt || new Date().toISOString(),
    items: Array.isArray(data.items) ? data.items : [],
  }
}

export async function syncWalletTransactions(
  version?: string,
): Promise<WalletTransactionsPayload & { changed: boolean }> {
  const q = version ? `?version=${encodeURIComponent(version)}` : ''
  const data = await apiFetch<{
    ok: boolean
    changed: boolean
    version?: string | null
    cachedAt?: string
    items?: WalletTransaction[]
  }>(`/api/wallet/transactions/sync${q}`)

  if (!data.changed) {
    const local = readLocalWalletTransactions() ?? emptyPayload()
    return {
      ...local,
      version: data.version ?? local.version,
      changed: false,
    }
  }

  return {
    version: data.version ?? null,
    cachedAt: data.cachedAt || new Date().toISOString(),
    items: Array.isArray(data.items) ? data.items : [],
    changed: true,
  }
}
