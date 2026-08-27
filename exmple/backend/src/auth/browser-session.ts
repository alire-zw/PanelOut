import { createHmac, timingSafeEqual } from 'node:crypto'
import { env } from '../config/env.js'

function sessionSecret(): string {
  return env.BROWSER_SESSION_SECRET?.trim() || env.TELEGRAM_BOT_TOKEN
}

function sign(payload: string): string {
  return createHmac('sha256', sessionSecret()).update(payload).digest('base64url')
}

export function createBrowserSessionToken(userId: number): {
  token: string
  expiresAt: string
  expiresInSeconds: number
} {
  const expiresInSeconds = env.BROWSER_SESSION_TTL_SECONDS
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds
  const payload = `${userId}.${exp}`
  const token = `${payload}.${sign(payload)}`
  return {
    token,
    expiresAt: new Date(exp * 1000).toISOString(),
    expiresInSeconds,
  }
}

export function verifyBrowserSessionToken(token: string): { userId: number } | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null

  const [userIdRaw, expRaw, providedSig] = parts
  if (!userIdRaw || !expRaw || !providedSig) return null

  const userId = Number(userIdRaw)
  const exp = Number(expRaw)
  if (!Number.isSafeInteger(userId) || userId <= 0) return null
  if (!Number.isFinite(exp) || exp * 1000 <= Date.now()) return null

  const payload = `${userIdRaw}.${expRaw}`
  const expectedSig = sign(payload)
  const left = Buffer.from(providedSig)
  const right = Buffer.from(expectedSig)
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return null
  }

  return { userId }
}

export function readBearerToken(header: string | string[] | undefined): string | null {
  const value = Array.isArray(header) ? header[0] : header
  if (typeof value !== 'string') return null
  const match = value.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || null
}
