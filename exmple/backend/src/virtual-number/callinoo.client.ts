import { request as httpRequest } from 'node:https'
import { request as httpRequestPlain } from 'node:http'
import { env } from '../config/env.js'

export type CallinooCountryRaw = {
  country: string
  price: number
  range: number | string
  count: string
  emoji: string
}

export type CallinooApiResponse<T> = {
  status: boolean
  status_code: number
  message: string
  data: T
}

export class CallinooApiError extends Error {
  readonly status: number
  readonly details?: unknown

  constructor(message: string, status = 502, details?: unknown) {
    super(message)
    this.name = 'CallinooApiError'
    this.status = status
    this.details = details
  }
}

function buildAuthHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${env.CALLINOO_API_TOKEN}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
}

async function callinooRequest<T>(input: {
  path: string
  method: 'GET' | 'POST'
  body?: Record<string, unknown>
}): Promise<{ statusCode: number; payload: CallinooApiResponse<T> | null }> {
  const url = new URL(input.path, env.CALLINOO_API_URL)
  const payloadText = input.body ? JSON.stringify(input.body) : undefined
  const transport = url.protocol === 'http:' ? httpRequestPlain : httpRequest

  return await new Promise((resolve, reject) => {
    const req = transport(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        method: input.method,
        headers: {
          ...buildAuthHeaders(),
          ...(payloadText ? { 'Content-Length': Buffer.byteLength(payloadText) } : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          const statusCode = res.statusCode ?? 0
          if (!text) {
            resolve({ statusCode, payload: null })
            return
          }

          try {
            resolve({
              statusCode,
              payload: JSON.parse(text) as CallinooApiResponse<T>,
            })
          } catch {
            reject(
              new CallinooApiError(`Callinoo returned invalid JSON (${statusCode})`, statusCode || 502, text),
            )
          }
        })
      },
    )

    req.on('error', (error) => reject(error))
    if (payloadText) req.write(payloadText)
    req.end()
  })
}

function assertCallinooSuccess<T>(
  statusCode: number,
  payload: CallinooApiResponse<T> | null,
): T {
  if (statusCode < 200 || statusCode >= 300 || !payload) {
    throw new CallinooApiError(
      payload?.message ?? `Callinoo request failed (${statusCode})`,
      statusCode || 502,
      payload,
    )
  }

  if (!payload.status) {
    throw new CallinooApiError(
      payload.message || 'Callinoo request failed',
      payload.status_code || statusCode || 502,
      payload,
    )
  }

  return payload.data
}

export async function fetchCallinooCountries(noneReport = true): Promise<CallinooCountryRaw[]> {
  // Callinoo docs: GET /telegram-numbers/numbers/ with JSON body { none_report }
  const { statusCode, payload } = await callinooRequest<CallinooCountryRaw[]>({
    path: '/telegram-numbers/numbers/',
    method: 'GET',
    body: {
      none_report: noneReport,
    },
  })

  const data = assertCallinooSuccess(statusCode, payload)
  return Array.isArray(data) ? data : []
}

export type CallinooPurchaseNumberRaw = {
  number: string
  order_id: number | string
  price: number
  countery?: string
  country?: string
  range: number | string
  service: string
  quality: string
}

export async function purchaseCallinooNumber(input: {
  countryId: string
  noneReport?: boolean
}): Promise<CallinooPurchaseNumberRaw> {
  const { statusCode, payload } = await callinooRequest<CallinooPurchaseNumberRaw>({
    path: '/telegram-numbers/numbers/',
    method: 'POST',
    body: {
      country_id: input.countryId,
      none_report: input.noneReport ?? true,
    },
  })

  return assertCallinooSuccess(statusCode, payload)
}

export type CallinooVerificationCodeRaw = {
  order_id?: number | string
  country?: string
  service_id?: number
  number?: string
  code?: string
  success?: boolean
}

export type CallinooVerificationCodeStatus =
  | 'ready'
  | 'pending'
  | 'not_received'
  | 'logged_out'

export type CallinooVerificationCodeResult = {
  status: CallinooVerificationCodeStatus
  message: string
  data?: CallinooVerificationCodeRaw
}

function classifyVerificationCodeResult(
  statusCode: number,
  payload: CallinooApiResponse<CallinooVerificationCodeRaw> | null,
): CallinooVerificationCodeResult {
  const message = payload?.message?.trim() || ''
  const lower = message.toLowerCase()
  const apiStatus = payload?.status_code ?? statusCode
  const code = payload?.data?.code != null ? String(payload.data.code).trim() : ''

  if (payload?.status && code) {
    return {
      status: 'ready',
      message: 'کد دریافت شد',
      data: payload.data,
    }
  }

  if (
    statusCode === 202 ||
    apiStatus === 202 ||
    /waiting for code/i.test(lower)
  ) {
    return {
      status: 'pending',
      message: 'در انتظار کد',
      data: payload?.data,
    }
  }

  if (/logout/i.test(lower)) {
    return {
      status: 'logged_out',
      message: 'لوگ‌اوت شده',
      data: payload?.data,
    }
  }

  if (
    /cancel/i.test(lower) ||
    /does not exist/i.test(lower) ||
    apiStatus === 404 ||
    statusCode === 404
  ) {
    return {
      status: 'not_received',
      message: 'کد دریافت نشده',
      data: payload?.data,
    }
  }

  if (/access denied/i.test(lower) || apiStatus === 422 || statusCode === 422) {
    return {
      status: 'logged_out',
      message: 'لوگ‌اوت شده',
      data: payload?.data,
    }
  }

  if (code) {
    return {
      status: 'ready',
      message: 'کد دریافت شد',
      data: payload?.data,
    }
  }

  if (!payload) {
    throw new CallinooApiError(`Callinoo request failed (${statusCode})`, statusCode || 502)
  }

  if (apiStatus === 401 || statusCode === 401 || apiStatus >= 500 || statusCode >= 500) {
    throw new CallinooApiError(message || `Callinoo request failed (${statusCode})`, apiStatus || statusCode || 502, payload)
  }

  return {
    status: 'pending',
    message: message || 'در انتظار کد',
    data: payload.data,
  }
}

export async function fetchCallinooVerificationCode(
  providerOrderId: string,
): Promise<CallinooVerificationCodeResult> {
  // Callinoo docs: GET /telegram-numbers/number-services/ with JSON body { order_id }
  const orderId = Number(providerOrderId)
  const { statusCode, payload } = await callinooRequest<CallinooVerificationCodeRaw>({
    path: '/telegram-numbers/number-services/',
    method: 'GET',
    body: {
      order_id: Number.isFinite(orderId) ? orderId : providerOrderId,
    },
  })

  return classifyVerificationCodeResult(statusCode, payload)
}

export type CallinooLogoutStatus = 'logged_out' | 'pending' | 'not_received' | 'failed'

export type CallinooLogoutResult = {
  status: CallinooLogoutStatus
  message: string
}

function classifyLogoutResult(
  statusCode: number,
  payload: CallinooApiResponse<{ success?: boolean } | CallinooVerificationCodeRaw> | null,
): CallinooLogoutResult {
  const message = payload?.message?.trim() || ''
  const lower = message.toLowerCase()
  const apiStatus = payload?.status_code ?? statusCode
  const data = payload?.data as { success?: boolean } | undefined

  if (payload?.status || data?.success === true || /logout successful/i.test(lower)) {
    return { status: 'logged_out', message: 'خروج از اکانت انجام شد' }
  }

  if (statusCode === 202 || apiStatus === 202 || /waiting for code/i.test(lower)) {
    return { status: 'pending', message: 'هنوز در انتظار کد است؛ خروج انجام نشد' }
  }

  if (/cancel/i.test(lower) || /does not exist/i.test(lower) || apiStatus === 404 || statusCode === 404) {
    return { status: 'not_received', message: 'سفارش لغو شده یا یافت نشد' }
  }

  if (/access denied/i.test(lower) || /unknown status/i.test(lower) || apiStatus === 422 || statusCode === 422) {
    return { status: 'failed', message: message || 'خروج از اکانت ناموفق بود' }
  }

  if (!payload) {
    throw new CallinooApiError(`Callinoo request failed (${statusCode})`, statusCode || 502)
  }

  if (apiStatus === 401 || statusCode === 401 || apiStatus >= 500 || statusCode >= 500) {
    throw new CallinooApiError(message || `Callinoo request failed (${statusCode})`, apiStatus || statusCode || 502, payload)
  }

  return { status: 'failed', message: message || 'خروج از اکانت ناموفق بود' }
}

export async function logoutCallinooTelegramAccount(
  providerOrderId: string,
): Promise<CallinooLogoutResult> {
  // Callinoo docs: POST /telegram-numbers/number-services/ with JSON body { order_id }
  const orderId = Number(providerOrderId)
  const { statusCode, payload } = await callinooRequest<{ success?: boolean } | CallinooVerificationCodeRaw>({
    path: '/telegram-numbers/number-services/',
    method: 'POST',
    body: {
      order_id: Number.isFinite(orderId) ? orderId : providerOrderId,
    },
  })

  return classifyLogoutResult(statusCode, payload)
}

export function isCallinooStockError(message: string): boolean {
  return /no available|ناموجود|unavailable|none report/i.test(message)
}
