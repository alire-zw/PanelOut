import { createHmac, timingSafeEqual } from 'node:crypto'

interface TelegramInitDataUser {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  language_code?: string
  is_premium?: boolean
  photo_url?: string
}

export interface ValidatedTelegramInitData {
  user: TelegramInitDataUser
  authDate: number
  queryId?: string
  hash: string
}

function parseInitData(initData: string): Map<string, string> {
  const params = new URLSearchParams(initData)
  const entries = new Map<string, string>()

  for (const [key, value] of params.entries()) {
    entries.set(key, value)
  }

  return entries
}

function buildDataCheckString(params: Map<string, string>): string {
  return [...params.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
}

export function validateTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 86_400,
): ValidatedTelegramInitData {
  const params = parseInitData(initData)
  const hash = params.get('hash')

  if (!hash) {
    throw new Error('Missing init data hash')
  }

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const dataCheckString = buildDataCheckString(params)
  const calculatedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  const received = Buffer.from(hash, 'hex')
  const expected = Buffer.from(calculatedHash, 'hex')

  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new Error('Invalid init data signature')
  }

  const authDateRaw = params.get('auth_date')
  if (!authDateRaw) {
    throw new Error('Missing auth_date')
  }

  const authDate = Number.parseInt(authDateRaw, 10)
  const now = Math.floor(Date.now() / 1000)

  if (!Number.isFinite(authDate) || now - authDate > maxAgeSeconds) {
    throw new Error('Init data expired')
  }

  const userRaw = params.get('user')
  if (!userRaw) {
    throw new Error('Missing user payload')
  }

  let user: TelegramInitDataUser
  try {
    user = JSON.parse(userRaw) as TelegramInitDataUser
  } catch {
    throw new Error('Invalid user payload')
  }

  if (!user?.id || !Number.isFinite(user.id)) {
    throw new Error('Invalid user id')
  }

  return {
    user,
    authDate,
    queryId: params.get('query_id') ?? undefined,
    hash,
  }
}
