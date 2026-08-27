import { env } from '../config/env.js'

export class MarketAppApiError extends Error {
  readonly status: number
  readonly details: unknown

  constructor(message: string, status = 502, details?: unknown) {
    super(message)
    this.name = 'MarketAppApiError'
    this.status = status
    this.details = details
  }
}

export type MarketAppCurrency = 'GRAM' | 'TON' | 'USDT'

export interface StarsPriceResponse {
  ton: number
  gram: number
}

export interface StarsRecipientResponse {
  photo: string
  name: string
}

function normalizeRecipientPhoto(photo: string): string {
  const value = photo.trim()
  if (!value) return ''

  if (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('data:') ||
    value.startsWith('//')
  ) {
    return value.startsWith('//') ? `https:${value}` : value
  }

  const srcMatch = value.match(/src\s*=\s*["']([^"']+)["']/i)
  if (srcMatch?.[1]) {
    const src = srcMatch[1].trim()
    return src.startsWith('//') ? `https:${src}` : src
  }

  // Raw base64 payload without data URI prefix
  if (/^[A-Za-z0-9+/=\s]+$/.test(value) && value.replace(/\s+/g, '').length > 64) {
    return `data:image/jpeg;base64,${value.replace(/\s+/g, '')}`
  }

  return value
}

function normalizeRecipientResponse(recipient: StarsRecipientResponse): StarsRecipientResponse {
  return {
    name: recipient.name,
    photo: normalizeRecipientPhoto(recipient.photo ?? ''),
  }
}

export interface TonTransactionMessage {
  address: string
  amount: string
  payload: string | null
  stateInit?: string | null
}

export interface TonTransaction {
  validUntil: number
  messages: TonTransactionMessage[]
}

export interface SendTxResponse {
  transaction: TonTransaction
}

export interface StarsGiveawayPriceItem {
  ton: number
  gram: number
  stars: number
  boosts: number
}

export interface StarsGiveawayPriceResponse {
  items: StarsGiveawayPriceItem[]
}

async function marketAppRequest<T>(
  path: string,
  init?: {
    method?: 'GET' | 'POST'
    body?: unknown
  },
): Promise<T> {
  const method = init?.method ?? 'POST'
  const headers: Record<string, string> = {
    Authorization: env.MARKETAPP_API_TOKEN,
    Accept: 'application/json',
  }

  if (init?.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(`${env.MARKETAPP_API_URL.replace(/\/$/, '')}${path}`, {
    method,
    headers,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  })

  let payload: unknown = null
  const text = await response.text()
  if (text) {
    try {
      payload = JSON.parse(text) as unknown
    } catch {
      payload = text
    }
  }

  if (!response.ok) {
    let message = `MarketApp request failed: ${response.status}`

    if (typeof payload === 'object' && payload !== null) {
      const detail = (payload as { detail?: unknown }).detail
      if (typeof detail === 'string' && detail.trim()) {
        message = detail
      } else if (Array.isArray(detail) && detail.length > 0) {
        const first = detail[0] as { msg?: string }
        if (typeof first?.msg === 'string' && first.msg.trim()) {
          message = first.msg
        }
      } else if (
        'message' in payload &&
        typeof (payload as { message?: unknown }).message === 'string'
      ) {
        message = (payload as { message: string }).message
      }
    }

    throw new MarketAppApiError(message, response.status >= 500 ? 502 : response.status, payload)
  }

  return payload as T
}

function normalizeUsername(username: string): string {
  return username.trim().replace(/^@+/, '')
}

export async function getStarsPrice(quantity: number): Promise<StarsPriceResponse> {
  return marketAppRequest<StarsPriceResponse>('/v1/fragment/stars/price/', {
    body: { quantity },
  })
}

export async function searchStarsRecipient(username: string): Promise<StarsRecipientResponse> {
  const recipient = await marketAppRequest<StarsRecipientResponse>('/v1/fragment/stars/recipient/', {
    body: { username: normalizeUsername(username) },
  })
  return normalizeRecipientResponse(recipient)
}

export async function buyStars(input: {
  username: string
  quantity: number
  currency?: MarketAppCurrency
}): Promise<SendTxResponse> {
  return marketAppRequest<SendTxResponse>('/v1/fragment/stars/buy/', {
    body: {
      username: normalizeUsername(input.username),
      quantity: input.quantity,
      ...(input.currency ? { currency: input.currency } : {}),
    },
  })
}

export async function getStarsGiveawayPrice(): Promise<StarsGiveawayPriceResponse> {
  return marketAppRequest<StarsGiveawayPriceResponse>('/v1/fragment/stars-giveaway/price/')
}

export async function searchStarsGiveawayRecipient(
  username: string,
): Promise<StarsRecipientResponse> {
  const recipient = await marketAppRequest<StarsRecipientResponse>(
    '/v1/fragment/stars-giveaway/recipient/',
    {
      body: { username: normalizeUsername(username) },
    },
  )
  return normalizeRecipientResponse(recipient)
}

export async function buyStarsGiveaway(input: {
  username: string
  quantity: number
  stars: number
}): Promise<SendTxResponse> {
  return marketAppRequest<SendTxResponse>('/v1/fragment/stars-giveaway/buy/', {
    body: {
      username: normalizeUsername(input.username),
      quantity: input.quantity,
      stars: input.stars,
    },
  })
}

export type PremiumMonths = 3 | 6 | 12

export interface PremiumPriceResponse {
  months3: StarsPriceResponse
  months6: StarsPriceResponse
  months12: StarsPriceResponse
}

export interface PremiumPriceItem {
  months: PremiumMonths
  ton: number
  gram: number
}

function normalizePremiumPrices(payload: PremiumPriceResponse): PremiumPriceItem[] {
  return [
    { months: 3, ton: payload.months3.ton, gram: payload.months3.gram },
    { months: 6, ton: payload.months6.ton, gram: payload.months6.gram },
    { months: 12, ton: payload.months12.ton, gram: payload.months12.gram },
  ]
}

export async function getPremiumPrices(): Promise<{ items: PremiumPriceItem[] }> {
  const payload = await marketAppRequest<PremiumPriceResponse>('/v1/fragment/premium/price/')
  return { items: normalizePremiumPrices(payload) }
}

export async function getPremiumPrice(months: PremiumMonths): Promise<StarsPriceResponse> {
  const { items } = await getPremiumPrices()
  const item = items.find((entry) => entry.months === months)
  if (!item) {
    throw new MarketAppApiError('Premium price not found', 404)
  }

  return { ton: item.ton, gram: item.gram }
}

export async function searchPremiumRecipient(
  username: string,
  months: PremiumMonths,
): Promise<StarsRecipientResponse> {
  const recipient = await marketAppRequest<StarsRecipientResponse>('/v1/fragment/premium/recipient/', {
    body: {
      username: normalizeUsername(username),
      months,
    },
  })
  return normalizeRecipientResponse(recipient)
}

export async function buyPremium(input: {
  username: string
  months: PremiumMonths
  currency?: MarketAppCurrency
}): Promise<SendTxResponse> {
  return marketAppRequest<SendTxResponse>('/v1/fragment/premium/buy/', {
    body: {
      username: normalizeUsername(input.username),
      months: input.months,
      ...(input.currency ? { currency: input.currency } : {}),
    },
  })
}
