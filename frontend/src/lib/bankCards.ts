import { apiFetch } from './api'
import type { BankCard } from '../types/payments'

export type BankCardsPayload = {
  version: string | null
  cachedAt: string
  scope: 'all' | 'active'
  cards: BankCard[]
}

const storageKey = (scope: 'all' | 'active') => `panelout.bank.cards.${scope}`

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function readLocalBankCards(scope: 'all' | 'active'): BankCardsPayload | null {
  return readJson<BankCardsPayload>(storageKey(scope))
}

export function writeLocalBankCards(payload: BankCardsPayload) {
  localStorage.setItem(storageKey(payload.scope), JSON.stringify(payload))
}

function emptyPayload(scope: 'all' | 'active'): BankCardsPayload {
  return {
    version: null,
    cachedAt: new Date().toISOString(),
    scope,
    cards: [],
  }
}

async function fetchBankCardsPayload(
  path: string,
  scope: 'all' | 'active',
): Promise<BankCardsPayload> {
  const data = await apiFetch<{
    ok: boolean
    version: string | null
    cachedAt: string
    scope?: 'all' | 'active'
    cards: BankCard[]
  }>(path)

  return {
    version: data.version ?? null,
    cachedAt: data.cachedAt || new Date().toISOString(),
    scope: data.scope || scope,
    cards: Array.isArray(data.cards) ? data.cards : [],
  }
}

async function syncBankCardsPayload(
  path: string,
  scope: 'all' | 'active',
  version?: string | null,
): Promise<BankCardsPayload & { changed: boolean }> {
  const params = new URLSearchParams()
  if (version) params.set('version', version)
  const q = params.toString()
  const data = await apiFetch<{
    ok: boolean
    changed: boolean
    version?: string | null
    cachedAt?: string
    scope?: 'all' | 'active'
    cards?: BankCard[]
  }>(`${path}${q ? `?${q}` : ''}`)

  if (!data.changed) {
    const local = readLocalBankCards(scope) ?? emptyPayload(scope)
    return {
      ...local,
      version: data.version ?? local.version,
      changed: false,
    }
  }

  return {
    version: data.version ?? null,
    cachedAt: data.cachedAt || new Date().toISOString(),
    scope: data.scope || scope,
    cards: Array.isArray(data.cards) ? data.cards : [],
    changed: true,
  }
}

export function fetchAdminBankCardsPayload() {
  return fetchBankCardsPayload('/api/admin/cards', 'all')
}

export function syncAdminBankCards(version?: string | null) {
  return syncBankCardsPayload('/api/admin/cards/sync', 'all', version)
}

export function fetchActiveBankCardsPayload() {
  return fetchBankCardsPayload('/api/payments/cards', 'active')
}

export function syncActiveBankCards(version?: string | null) {
  return syncBankCardsPayload('/api/payments/cards/sync', 'active', version)
}
