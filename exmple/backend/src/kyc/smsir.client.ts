import { env } from '../config/env.js'

export class SmsIrApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message)
    this.name = 'SmsIrApiError'
  }
}

interface SmsIrVerifyResponse {
  status?: number
  message?: string
  data?: {
    messageId?: number
    cost?: number
  }
}

export async function sendSmsIrVerify(input: {
  mobile: string
  templateId: number
  parameters: Array<{ name: string; value: string }>
}): Promise<{ messageId: number; cost: number }> {
  const response = await fetch(`${env.SMSIR_API_URL.replace(/\/$/, '')}/send/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/plain',
      'x-api-key': env.SMSIR_API_KEY,
    },
    body: JSON.stringify({
      mobile: input.mobile,
      templateId: input.templateId,
      parameters: input.parameters,
    }),
  })

  let payload: SmsIrVerifyResponse | null = null
  try {
    payload = (await response.json()) as SmsIrVerifyResponse
  } catch {
    payload = null
  }

  if (!response.ok) {
    throw new SmsIrApiError(
      payload?.message ?? `SMS.ir HTTP error: ${response.status}`,
      payload?.status,
    )
  }

  if (payload?.status !== 1 || !payload.data?.messageId) {
    throw new SmsIrApiError(payload?.message ?? 'ارسال پیامک ناموفق بود', payload?.status)
  }

  return {
    messageId: payload.data.messageId,
    cost: Number(payload.data.cost ?? 0),
  }
}
