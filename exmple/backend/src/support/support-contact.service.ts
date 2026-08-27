import { redis } from '../redis/client.js'

const SUPPORT_TELEGRAM_KEY = 'site:settings:support_telegram'

export function normalizeSupportTelegram(raw: string): string | null {
  const cleaned = raw
    .trim()
    .replace(/^@+/, '')
    .replace(/^https?:\/\/(t\.me|telegram\.me)\//i, '')
    .replace(/\/.*$/, '')
    .trim()

  if (!cleaned) return null
  // username: 5–32 chars, letters/digits/underscore
  if (!/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(cleaned)) {
    return null
  }
  return cleaned
}

export async function getSupportTelegramUsername(): Promise<string | null> {
  const raw = await redis.get(SUPPORT_TELEGRAM_KEY)
  if (!raw) return null
  return normalizeSupportTelegram(raw)
}

export async function setSupportTelegramUsername(raw: string): Promise<string | null> {
  const normalized = normalizeSupportTelegram(raw)
  if (!normalized) {
    await redis.del(SUPPORT_TELEGRAM_KEY)
    return null
  }
  await redis.set(SUPPORT_TELEGRAM_KEY, normalized)
  return normalized
}
