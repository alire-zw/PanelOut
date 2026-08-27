import { env } from '../config/env.js'

export class RoboticvnApiError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message)
    this.name = 'RoboticvnApiError'
  }
}

export type RoboticvnProductSummary = {
  id: string
  title: string
}

export type RoboticvnProductVariant = {
  id: string
  title: string
  prices: Record<string, number>
  in_stock: boolean
  available_quantity: number
}

export type RoboticvnProductDetail = {
  id: string
  title: string
  description: string | null
  thumbnail: string | null
  in_stock: boolean
  variants: RoboticvnProductVariant[]
}

type ListProductsResponse = {
  data: RoboticvnProductSummary[]
  meta: { count: number; limit: number; offset: number }
}

type ProductDetailResponse = {
  data: RoboticvnProductDetail
}

function requireApiKey(): string {
  const key = env.ROBOTICVN_API_KEY?.trim()
  if (!key) {
    throw new RoboticvnApiError('Roboticvn API key is not configured', 503)
  }
  return key
}

async function roboticvnFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const apiKey = requireApiKey()
  const url = `${env.ROBOTICVN_API_URL.replace(/\/$/, '')}${path}`
  const headers = new Headers(init?.headers)
  headers.set('x-api-key', apiKey)
  headers.set('Accept', 'application/json')
  if (!headers.has('Accept-Language')) {
    headers.set('Accept-Language', 'en-US')
  }

  const response = await fetch(url, {
    ...init,
    headers,
  })

  if (!response.ok) {
    let message = `Roboticvn request failed (${response.status})`
    try {
      const payload = (await response.json()) as {
        error?: { message?: string }
        message?: string
      }
      message = payload.error?.message ?? payload.message ?? message
    } catch {
      // ignore
    }
    throw new RoboticvnApiError(message, response.status >= 400 && response.status < 600 ? response.status : 502)
  }

  return (await response.json()) as T
}

export async function listRoboticvnProducts(input?: {
  search?: string
  limit?: number
  offset?: number
}): Promise<ListProductsResponse> {
  const params = new URLSearchParams()
  params.set('limit', String(input?.limit ?? 50))
  params.set('offset', String(input?.offset ?? 0))
  if (input?.search?.trim()) {
    params.set('search', input.search.trim())
  }
  return roboticvnFetch<ListProductsResponse>(`/api/v2/products?${params.toString()}`)
}

export async function getRoboticvnProduct(productId: string): Promise<RoboticvnProductDetail> {
  const id = productId.trim()
  if (!id) {
    throw new RoboticvnApiError('Product id is required', 400)
  }
  const response = await roboticvnFetch<ProductDetailResponse>(
    `/api/v2/products/${encodeURIComponent(id)}`,
  )
  return response.data
}
