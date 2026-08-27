import { env } from '../config/env.js'

export const ZIBAL_FACILITY_SUCCESS_CODE = 1

export class ZibalFacilityError extends Error {
  constructor(
    message: string,
    public readonly resultCode: number,
    public readonly phase: 'shahkar' | 'card-national',
  ) {
    super(message)
    this.name = 'ZibalFacilityError'
  }
}

type FacilityMatchedResponse = {
  result: number
  message?: string
  data?: {
    matched?: boolean
  }
}

function requireFacilityToken(): string {
  const token = env.ZIBAL_FACILITY_ACCESS_TOKEN.trim()
  if (!token) {
    throw new ZibalFacilityError(
      'توکن وب‌سرویس استعلام زیبال پیکربندی نشده است',
      2,
      'shahkar',
    )
  }
  return token
}

async function postFacility<T>(
  path: string,
  body: unknown,
  phase: 'shahkar' | 'card-national',
): Promise<T> {
  const token = requireFacilityToken()
  const response = await fetch(`${env.ZIBAL_FACILITY_BASE_URL.replace(/\/$/, '')}/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  let payload: FacilityMatchedResponse | null = null
  try {
    payload = (await response.json()) as FacilityMatchedResponse
  } catch {
    payload = null
  }

  if (!response.ok) {
    throw new ZibalFacilityError(
      payload?.message ?? `خطای وب‌سرویس زیبال (${response.status})`,
      payload?.result ?? response.status,
      phase,
    )
  }

  if (!payload) {
    throw new ZibalFacilityError('پاسخ نامعتبر از وب‌سرویس زیبال', 0, phase)
  }

  return payload as T
}

export async function zibalShahkarInquiry(input: {
  mobile: string
  nationalCode: string
}): Promise<{ matched: boolean; result: number; message: string }> {
  const response = await postFacility<FacilityMatchedResponse>(
    'v1/facility/shahkarInquiry',
    {
      mobile: input.mobile,
      nationalCode: input.nationalCode,
    },
    'shahkar',
  )

  if (response.result !== ZIBAL_FACILITY_SUCCESS_CODE) {
    throw new ZibalFacilityError(
      response.message ?? 'استعلام شاهکار ناموفق بود',
      response.result,
      'shahkar',
    )
  }

  return {
    matched: Boolean(response.data?.matched),
    result: response.result,
    message: response.message ?? 'موفق',
  }
}

export async function zibalCheckCardWithNationalCode(input: {
  nationalCode: string
  birthDate: string
  cardNumber: string
}): Promise<{ matched: boolean; result: number; message: string }> {
  const response = await postFacility<FacilityMatchedResponse>(
    'v1/facility/checkCardWithNationalCode',
    {
      nationalCode: input.nationalCode,
      birthDate: input.birthDate,
      cardNumber: input.cardNumber,
    },
    'card-national',
  )

  if (response.result !== ZIBAL_FACILITY_SUCCESS_CODE) {
    throw new ZibalFacilityError(
      response.message ?? 'استعلام تطابق کارت و کد ملی ناموفق بود',
      response.result,
      'card-national',
    )
  }

  return {
    matched: Boolean(response.data?.matched),
    result: response.result,
    message: response.message ?? 'موفق',
  }
}
