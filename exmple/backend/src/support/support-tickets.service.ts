import { createHash } from 'node:crypto'
import { prisma } from '../db/client.js'
import {
  invalidateSupportTicketDetailCache,
  invalidateSupportTicketsCache,
  readSupportTicketDetailCache,
  readSupportTicketsCache,
  writeSupportTicketDetailCache,
  writeSupportTicketsCache,
} from './support-tickets.cache.js'
import type {
  CachedSupportTicketDetail,
  CachedSupportTickets,
  SupportTicketsSyncResult,
} from './support-tickets.types.js'
import { serializeTicketSummary } from './support.serializer.js'

async function buildTicketsVersion(userId: number): Promise<string> {
  const [ticketAgg, messageAgg] = await Promise.all([
    prisma.supportTicket.aggregate({
      where: { userId },
      _count: { id: true },
      _max: { id: true, updatedAt: true },
    }),
    prisma.supportTicketMessage.aggregate({
      where: { ticket: { userId } },
      _count: { id: true },
      _max: { id: true },
    }),
  ])

  const fingerprint = [
    ticketAgg._count.id,
    ticketAgg._max.id ?? 0,
    ticketAgg._max.updatedAt?.toISOString() ?? '',
    messageAgg._count.id,
    messageAgg._max.id ?? 0,
  ].join('|')

  return createHash('sha256').update(fingerprint).digest('hex').slice(0, 16)
}

export async function buildTicketDetailVersion(ticketId: number): Promise<string> {
  const [ticket, messageAgg] = await Promise.all([
    prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: { updatedAt: true, status: true },
    }),
    prisma.supportTicketMessage.aggregate({
      where: { ticketId },
      _count: { id: true },
      _max: { id: true },
    }),
  ])

  const fingerprint = [
    ticket?.updatedAt.toISOString() ?? '',
    ticket?.status ?? '',
    messageAgg._count.id,
    messageAgg._max.id ?? 0,
  ].join('|')

  return createHash('sha256').update(fingerprint).digest('hex').slice(0, 16)
}

async function buildTicketsList(userId: number) {
  const tickets = await prisma.supportTicket.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  })

  return tickets.map((ticket) => serializeTicketSummary(ticket))
}

async function refreshSupportTicketsCache(userId: number): Promise<CachedSupportTickets> {
  const [items, version] = await Promise.all([
    buildTicketsList(userId),
    buildTicketsVersion(userId),
  ])

  const payload: CachedSupportTickets = {
    version,
    cachedAt: new Date().toISOString(),
    items,
  }

  await writeSupportTicketsCache(userId, payload)
  return payload
}

export async function getSupportTicketsCached(userId: number): Promise<CachedSupportTickets> {
  const cached = await readSupportTicketsCache(userId)
  if (cached) return cached
  return refreshSupportTicketsCache(userId)
}

export async function syncSupportTickets(
  userId: number,
  clientVersion?: string,
): Promise<SupportTicketsSyncResult> {
  const currentVersion = await buildTicketsVersion(userId)
  const cached = await readSupportTicketsCache(userId)

  const isUpToDate =
    cached &&
    cached.version === currentVersion &&
    (!clientVersion || clientVersion === currentVersion)

  if (isUpToDate) {
    return {
      changed: false,
      version: cached.version,
      cachedAt: cached.cachedAt,
      items: cached.items,
    }
  }

  const fresh = await refreshSupportTicketsCache(userId)

  return {
    changed: !clientVersion || clientVersion !== fresh.version,
    version: fresh.version,
    cachedAt: fresh.cachedAt,
    items: fresh.items,
  }
}

export async function readCachedTicketDetail(userId: number, ticketCode: string) {
  return readSupportTicketDetailCache(userId, ticketCode)
}

export async function writeCachedTicketDetail(
  userId: number,
  ticketCode: string,
  ticketId: number,
  ticket: CachedSupportTicketDetail['ticket'],
): Promise<CachedSupportTicketDetail> {
  const version = await buildTicketDetailVersion(ticketId)
  const payload: CachedSupportTicketDetail = {
    version,
    cachedAt: new Date().toISOString(),
    ticket,
  }
  await writeSupportTicketDetailCache(userId, ticketCode, payload)
  return payload
}

export async function invalidateUserSupportCaches(
  userId: number,
  ticketCode?: string | null,
): Promise<void> {
  await invalidateSupportTicketsCache(userId)
  if (ticketCode) {
    await invalidateSupportTicketDetailCache(userId, ticketCode)
  }
}

export { invalidateSupportTicketsCache }
