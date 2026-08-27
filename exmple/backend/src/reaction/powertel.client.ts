import { env } from '../config/env.js'
import { log } from '../lib/logger.js'

export type PowerTelService = {
  service: number
  name: string
  type: string
  category: string
  rate: number
  min: number
  max: number
  desc: string
}

export type PowerTelBalance = {
  balance: number
  currency: string
}

export class PowerTelApiError extends Error {
  readonly status: number
  readonly details?: unknown

  constructor(message: string, status = 502, details?: unknown) {
    super(message)
    this.name = 'PowerTelApiError'
    this.status = status
    this.details = details
  }
}

function buildEndpoint(): URL {
  return new URL(env.POWERTEL_API_URL)
}

function toNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : NaN
}

function extractErrorMessage(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null

  const record = payload as Record<string, unknown>
  if (typeof record.error === 'string' && record.error.trim()) {
    return record.error.trim()
  }

  if (record.status === 'fail' || record.status === 'error') {
    if (typeof record.message === 'string' && record.message.trim()) {
      return record.message.trim()
    }
    return 'Power-Tel request failed'
  }

  return null
}

async function powerTelRequest<T>(
  params: Record<string, string | number>,
  method: 'GET' | 'POST' = 'POST',
): Promise<T> {
  const body = new URLSearchParams()
  body.set('key', env.POWERTEL_API_KEY)

  for (const [key, value] of Object.entries(params)) {
    body.set(key, String(value))
  }

  const url = buildEndpoint()
  const init: RequestInit =
    method === 'GET'
      ? {
          method: 'GET',
          headers: { Accept: 'application/json' },
        }
      : {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body,
        }

  if (method === 'GET') {
    for (const [key, value] of body.entries()) {
      url.searchParams.set(key, value)
    }
  }

  const response = await fetch(url, init)
  const payload = (await response.json().catch(() => null)) as unknown

  if (!response.ok || payload == null) {
    throw new PowerTelApiError(
      `Power-Tel request failed (${response.status})`,
      response.status || 502,
      payload,
    )
  }

  const errorMessage = extractErrorMessage(payload)
  if (errorMessage) {
    throw new PowerTelApiError(errorMessage, 502, payload)
  }

  return payload as T
}

function normalizeService(raw: Record<string, unknown>): PowerTelService | null {
  const service = toNumber(raw.service)
  const rate = toNumber(raw.rate)
  const min = toNumber(raw.min)
  const max = toNumber(raw.max)

  if (![service, rate, min, max].every(Number.isFinite)) {
    return null
  }

  return {
    service,
    name: String(raw.name ?? ''),
    type: String(raw.type ?? ''),
    category: String(raw.category ?? ''),
    rate,
    min,
    max,
    desc: String(raw.desc ?? ''),
  }
}

export async function fetchPowerTelServices(): Promise<PowerTelService[]> {
  const payload = await powerTelRequest<unknown>({ action: 'services' }, 'GET')

  if (!Array.isArray(payload)) {
    throw new PowerTelApiError('Invalid Power-Tel services response', 502, payload)
  }

  return payload
    .map((item) =>
      typeof item === 'object' && item !== null
        ? normalizeService(item as Record<string, unknown>)
        : null,
    )
    .filter((item): item is PowerTelService => item != null)
}

export async function fetchPowerTelBalance(): Promise<PowerTelBalance> {
  const payload = await powerTelRequest<Record<string, unknown>>({ action: 'balance' }, 'GET')
  const balance = toNumber(payload.balance)

  if (!Number.isFinite(balance)) {
    throw new PowerTelApiError('Invalid Power-Tel balance response', 502, payload)
  }

  return {
    balance,
    currency: String(payload.currency ?? 'toman'),
  }
}

export async function addPowerTelOrder(input: {
  service: number
  link: string
  quantity: number
}): Promise<string> {
  const payload = await powerTelRequest<Record<string, unknown>>(
    {
      action: 'add',
      service: input.service,
      link: input.link,
      quantity: input.quantity,
    },
    'POST',
  )

  const orderId = payload.order ?? payload.order_id
  if (orderId == null || String(orderId).trim() === '') {
    throw new PowerTelApiError('Power-Tel did not return an order id', 502, payload)
  }

  log.info('POWERTEL', 'order added', {
    service: input.service,
    quantity: input.quantity,
    providerOrderId: String(orderId),
  })

  return String(orderId)
}

export async function fetchPowerTelOrderStatus(orderId: string): Promise<Record<string, unknown>> {
  return powerTelRequest<Record<string, unknown>>(
    {
      action: 'status',
      order: orderId,
    },
    'POST',
  )
}
