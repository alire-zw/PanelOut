import { redis } from '../redis/client.js'
import type { CachedSupportTicketDetail, CachedSupportTickets } from './support-tickets.types.js'

const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60

function buildListCacheKey(userId: number): string {
  return `support:tickets:v1:${userId}`
}

function buildDetailCacheKey(userId: number, ticketCode: string): string {
  return `support:ticket:v1:${userId}:${ticketCode}`
}

export async function readSupportTicketsCache(
  userId: number,
): Promise<CachedSupportTickets | null> {
  const raw = await redis.get(buildListCacheKey(userId))
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as CachedSupportTickets
    if (!parsed?.version || !Array.isArray(parsed.items)) return null
    return parsed
  } catch {
    return null
  }
}

export async function writeSupportTicketsCache(
  userId: number,
  payload: CachedSupportTickets,
): Promise<void> {
  await redis.set(buildListCacheKey(userId), JSON.stringify(payload), 'EX', CACHE_TTL_SECONDS)
}

export async function invalidateSupportTicketsCache(userId: number): Promise<void> {
  await redis.del(buildListCacheKey(userId))
}

export async function readSupportTicketDetailCache(
  userId: number,
  ticketCode: string,
): Promise<CachedSupportTicketDetail | null> {
  const raw = await redis.get(buildDetailCacheKey(userId, ticketCode))
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as CachedSupportTicketDetail
    if (!parsed?.version || !parsed.ticket) return null
    return parsed
  } catch {
    return null
  }
}

export async function writeSupportTicketDetailCache(
  userId: number,
  ticketCode: string,
  payload: CachedSupportTicketDetail,
): Promise<void> {
  await redis.set(
    buildDetailCacheKey(userId, ticketCode),
    JSON.stringify(payload),
    'EX',
    CACHE_TTL_SECONDS,
  )
}

export async function invalidateSupportTicketDetailCache(
  userId: number,
  ticketCode: string,
): Promise<void> {
  await redis.del(buildDetailCacheKey(userId, ticketCode))
}
