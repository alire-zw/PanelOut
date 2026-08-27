import { env } from '../config/env.js'
import { getZibalRequestMessage, getZibalVerifyMessage, ZIBAL_SUCCESS_CODE } from './zibal.constants.js'

export class ZibalApiError extends Error {
  constructor(
    message: string,
    public readonly resultCode: number,
    public readonly phase: 'request' | 'verify' | 'inquiry',
  ) {
    super(message)
    this.name = 'ZibalApiError'
  }
}

interface ZibalRequestPayload {
  merchant: string
  amount: number
  callbackUrl: string
  description?: string
  orderId: string
  mobile?: string
}

interface ZibalVerifyPayload {
  merchant: string
  trackId: number
}

interface ZibalInquiryPayload {
  merchant: string
  trackId: number
}

interface ZibalRequestResponse {
  result: number
  message?: string
  trackId?: number
}

interface ZibalVerifyResponse {
  result: number
  message?: string
  amount?: number
  refNumber?: number | string
  cardNumber?: string
  orderId?: string
  status?: number
}

export interface ZibalInquiryResponse {
  result: number
  message?: string
  amount?: number
  refNumber?: number | string
  cardNumber?: string
  orderId?: string
  status?: number
}

async function postToZibal<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${env.ZIBAL_GATEWAY_URL}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`Zibal HTTP error: ${response.status}`)
  }

  return response.json() as Promise<T>
}

export async function createZibalPaymentRequest(input: {
  amountRial: number
  callbackUrl: string
  orderId: string
  description?: string
  mobile?: string
}): Promise<{ trackId: number; result: number; message: string }> {
  const payload: ZibalRequestPayload = {
    merchant: env.ZIBAL_MERCHANT,
    amount: input.amountRial,
    callbackUrl: input.callbackUrl,
    orderId: input.orderId,
    description: input.description,
    mobile: input.mobile,
  }

  const response = await postToZibal<ZibalRequestResponse>('v1/request', payload)

  if (response.result !== ZIBAL_SUCCESS_CODE || !response.trackId) {
    throw new ZibalApiError(getZibalRequestMessage(response.result), response.result, 'request')
  }

  return {
    trackId: response.trackId,
    result: response.result,
    message: response.message ?? getZibalRequestMessage(response.result),
  }
}

export async function verifyZibalPayment(trackId: number): Promise<{
  result: number
  message: string
  amount?: number
  refNumber?: string
  cardNumber?: string
  orderId?: string
}> {
  const payload: ZibalVerifyPayload = {
    merchant: env.ZIBAL_MERCHANT,
    trackId,
  }

  const response = await postToZibal<ZibalVerifyResponse>('v1/verify', payload)

  if (response.result !== ZIBAL_SUCCESS_CODE) {
    throw new ZibalApiError(getZibalVerifyMessage(response.result), response.result, 'verify')
  }

  return {
    result: response.result,
    message: getZibalVerifyMessage(response.result),
    amount: response.amount,
    refNumber: response.refNumber?.toString(),
    cardNumber: response.cardNumber,
    orderId: response.orderId,
  }
}

export async function inquireZibalPayment(trackId: number): Promise<ZibalInquiryResponse> {
  const payload: ZibalInquiryPayload = {
    merchant: env.ZIBAL_MERCHANT,
    trackId,
  }

  return postToZibal<ZibalInquiryResponse>('v1/inquiry', payload)
}

export function buildZibalPaymentUrl(trackId: number | bigint): string {
  return `${env.ZIBAL_GATEWAY_URL}/start/${trackId.toString()}`
}
