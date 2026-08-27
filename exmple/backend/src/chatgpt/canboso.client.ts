import { env } from '../config/env.js'

export class CanbosoApiError extends Error {
  constructor(
    message: string,
    readonly status = 502,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = 'CanbosoApiError'
  }
}

export type CanbosoProduct = {
  _id: string
  product_name?: string
  product_name_raw?: string
  pricing?: number
  walletCurrency?: string
  walletPricing?: number
  walletPricingText?: string
  usdPricing?: number
  slotProductType?: string
  isSlotProduct?: boolean
  requiresCustomerEmail?: boolean
  requiresSlotMonths?: boolean
  quantityFixed?: number | null
  slotDurations?: number[]
  stats?: {
    total?: number | null
    sold?: number
    available?: number | null
  }
}

type CanbosoProductsResponse = {
  success?: boolean
  message?: string
  products?: CanbosoProduct[]
}

export async function fetchCanbosoProducts(): Promise<CanbosoProduct[]> {
  const url = new URL('/api/telegram-buyer/products', env.CANBOSO_API_URL)
  url.searchParams.set('key', env.CANBOSO_BUYER_API_KEY)

  let response: Response
  try {
    response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    })
  } catch (error) {
    throw new CanbosoApiError(
      'اتصال به سرویس فروش اکانت برقرار نشد',
      502,
      error instanceof Error ? error.message : error,
    )
  }

  let payload: CanbosoProductsResponse | null = null
  try {
    payload = (await response.json()) as CanbosoProductsResponse
  } catch {
    payload = null
  }

  if (!response.ok || payload?.success === false) {
    throw new CanbosoApiError(
      payload?.message?.trim() || `Canboso request failed: ${response.status}`,
      response.status >= 400 && response.status < 600 ? response.status : 502,
      payload,
    )
  }

  return Array.isArray(payload?.products) ? payload.products : []
}
