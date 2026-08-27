import { prisma } from '../db/client.js'
import { redis } from '../redis/client.js'
import { log } from '../lib/logger.js'

const ONLINE_ZSET_KEY = 'analytics:online:users'
const ONLINE_WINDOW_MS = 5 * 60 * 1000
const DB_PERSIST_COOLDOWN_MS = 30 * 1000

let lastPersistAt = 0

async function pruneOfflineMembers(now = Date.now()): Promise<void> {
  await redis.zremrangebyscore(ONLINE_ZSET_KEY, 0, now - ONLINE_WINDOW_MS)
}

export async function touchUserPresence(userId: number): Promise<number> {
  const now = Date.now()
  const pipeline = redis.pipeline()
  pipeline.zadd(ONLINE_ZSET_KEY, now, String(userId))
  pipeline.zremrangebyscore(ONLINE_ZSET_KEY, 0, now - ONLINE_WINDOW_MS)
  pipeline.zcard(ONLINE_ZSET_KEY)
  const results = await pipeline.exec()
  const onlineCount = Number(results?.[2]?.[1] ?? 0)

  if (now - lastPersistAt >= DB_PERSIST_COOLDOWN_MS) {
    lastPersistAt = now
    void persistOnlineStat(onlineCount).catch((error) => {
      log.error(
        'ANALYTICS',
        error instanceof Error ? error.message : 'persistOnlineStat failed',
      )
    })
  }

  return onlineCount
}

export function touchUserPresenceSafe(userId: number | undefined): void {
  if (!userId) return
  void touchUserPresence(userId).catch((error) => {
    log.error('ANALYTICS', error instanceof Error ? error.message : 'touchUserPresence failed')
  })
}

export async function getOnlineUserCount(): Promise<number> {
  const now = Date.now()
  await pruneOfflineMembers(now)
  return redis.zcard(ONLINE_ZSET_KEY)
}

async function persistOnlineStat(onlineCount: number): Promise<void> {
  const existing = await prisma.siteOnlineStat.findUnique({ where: { id: 1 } })
  const peakOnline = Math.max(existing?.peakOnline ?? 0, onlineCount)

  await prisma.siteOnlineStat.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      onlineCount,
      peakOnline,
    },
    update: {
      onlineCount,
      peakOnline,
    },
  })
}

export async function getOnlineStats() {
  const onlineCount = await getOnlineUserCount()
  const persisted = await prisma.siteOnlineStat.findUnique({ where: { id: 1 } })

  return {
    onlineCount,
    peakOnline: Math.max(persisted?.peakOnline ?? 0, onlineCount),
    persistedOnlineCount: persisted?.onlineCount ?? 0,
    updatedAt: persisted?.updatedAt?.toISOString() ?? null,
  }
}
