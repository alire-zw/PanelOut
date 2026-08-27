import { createHash } from 'node:crypto'
import { prisma } from '../db/client.js'
import { listUserOrders } from './order.service.js'
import { serializeOrder } from './order.serializer.js'
import {
  invalidateUserOrdersCache,
  readUserOrdersCache,
  writeUserOrdersCache,
} from './user-orders.cache.js'
import type { CachedUserOrders, UserOrdersSyncResult } from './user-orders.types.js'

const LIST_LIMIT = 50

async function buildUserOrdersVersion(userId: number): Promise<string> {
  const [aggregate, accountShopAggregate] = await Promise.all([
    prisma.order.aggregate({
      where: { userId },
      _max: { id: true, updatedAt: true, createdAt: true },
      _count: true,
    }),
    prisma.accountShopOrder.aggregate({
      where: { order: { userId } },
      _max: { id: true, updatedAt: true },
      _count: true,
    }),
  ])

  const fingerprint = JSON.stringify({
    count: aggregate._count,
    maxId: aggregate._max.id,
    maxUpdatedAt: aggregate._max.updatedAt?.toISOString() ?? null,
    maxCreatedAt: aggregate._max.createdAt?.toISOString() ?? null,
    accountShopCount: accountShopAggregate._count,
    accountShopMaxId: accountShopAggregate._max.id,
    accountShopMaxUpdatedAt: accountShopAggregate._max.updatedAt?.toISOString() ?? null,
  })

  return createHash('sha256').update(fingerprint).digest('hex').slice(0, 16)
}

async function refreshUserOrdersCache(userId: number): Promise<CachedUserOrders> {
  const [orders, version] = await Promise.all([
    listUserOrders(userId, LIST_LIMIT),
    buildUserOrdersVersion(userId),
  ])

  const payload: CachedUserOrders = {
    version,
    cachedAt: new Date().toISOString(),
    items: orders.map((order) => serializeOrder(order)),
  }

  await writeUserOrdersCache(userId, payload)
  return payload
}

export async function getUserOrders(userId: number): Promise<CachedUserOrders> {
  const cached = await readUserOrdersCache(userId)
  if (cached) {
    return cached
  }

  return refreshUserOrdersCache(userId)
}

export async function syncUserOrders(
  userId: number,
  clientVersion?: string,
): Promise<UserOrdersSyncResult> {
  const currentVersion = await buildUserOrdersVersion(userId)
  const cached = await readUserOrdersCache(userId)

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

  const fresh = await refreshUserOrdersCache(userId)

  return {
    changed: !clientVersion || clientVersion !== fresh.version,
    version: fresh.version,
    cachedAt: fresh.cachedAt,
    items: fresh.items,
  }
}

export { invalidateUserOrdersCache }
