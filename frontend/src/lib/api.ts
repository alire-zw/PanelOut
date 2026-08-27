import type { AppUser } from '../types/user'

export function getApiBaseUrl() {
  return (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
}

function getTelegramInitData() {
  return window.Telegram?.WebApp?.initData?.trim() || ''
}

export class ApiError extends Error {
  status: number
  retryAfterSeconds?: number

  constructor(message: string, status: number, retryAfterSeconds?: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.retryAfterSeconds = retryAfterSeconds
  }
}

type ApiFetchOptions = RequestInit & {
  auth?: boolean
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { auth = true, headers: initHeaders, ...rest } = options
  const headers = new Headers(initHeaders)
  headers.set('Accept', 'application/json')

  if (auth) {
    const initData = getTelegramInitData()
    if (!initData) {
      throw new ApiError('Telegram init data is missing', 401)
    }
    headers.set('Authorization', `tma ${initData}`)
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...rest,
    headers,
  })

  let payload: unknown = null
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    payload = await response.json()
  }

  if (!response.ok) {
    const body =
      payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null
    const message =
      body && typeof body.error === 'string'
        ? body.error
        : `Request failed (${response.status})`
    const retryAfterRaw = body?.retryAfterSeconds
    const retryAfterSeconds =
      typeof retryAfterRaw === 'number'
        ? retryAfterRaw
        : typeof retryAfterRaw === 'string'
          ? Number(retryAfterRaw)
          : undefined
    throw new ApiError(
      message,
      response.status,
      Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined,
    )
  }

  return payload as T
}

/** Balance is already stored in Tomans (integer). */
export function balanceToToman(balance: number) {
  return Math.trunc(Number(balance) || 0)
}

export function formatUserDisplayName(user: AppUser) {
  if (user.realName?.trim()) return user.realName.trim()
  if (user.telegramName?.trim()) return user.telegramName.trim()
  if (user.username?.trim()) return `@${user.username.trim()}`
  return 'کاربر'
}

export function isTelegramWebApp() {
  return Boolean(window.Telegram?.WebApp?.initData)
}
