import { prisma } from '../db/client.js'
import { redis } from '../redis/client.js'
import { log } from '../lib/logger.js'
import { isKnownShopProductKey, SHOP_PRODUCT_KEYS } from './analytics.schema.js'

/** One unique view per user / product / Tehran calendar day. */
const VIEW_DEDUPE_TTL_SECONDS = 36 * 60 * 60

function tehranDayKey(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/** DATE column value without timezone shift (UTC midnight of calendar day). */
function tehranDayDate(date = new Date()): Date {
  const parts = tehranDayKey(date).split('-').map(Number)
  const year = parts[0]
  const month = parts[1]
  const day = parts[2]
  if (year == null || month == null || day == null) {
    return new Date(Date.UTC(1970, 0, 1))
  }
  return new Date(Date.UTC(year, month - 1, day))
}

function formatStoredDay(day: Date): string {
  return day.toISOString().slice(0, 10)
}

function viewDedupeKey(userId: number, productKey: string, dayKey: string): string {
  return `analytics:view-dedupe:${userId}:${productKey}:${dayKey}`
}

export async function recordProductView(
  userId: number,
  productKey: string,
): Promise<{ recorded: boolean; productKey: string }> {
  const normalizedKey = productKey.trim().toLowerCase()
  if (!normalizedKey || !isKnownShopProductKey(normalizedKey)) {
    return { recorded: false, productKey: normalizedKey }
  }

  const dayKey = tehranDayKey()
  const day = tehranDayDate()

  try {
    const dedupe = await redis.set(
      viewDedupeKey(userId, normalizedKey, dayKey),
      '1',
      'EX',
      VIEW_DEDUPE_TTL_SECONDS,
      'NX',
    )
    if (dedupe !== 'OK') {
      return { recorded: false, productKey: normalizedKey }
    }
  } catch (error) {
    log.error(
      'ANALYTICS',
      error instanceof Error ? error.message : 'View dedupe redis failed',
    )
    // Without Redis, skip write to avoid double-count from page+API races.
    return { recorded: false, productKey: normalizedKey }
  }

  await prisma.$transaction([
    prisma.productViewStat.upsert({
      where: { productKey: normalizedKey },
      create: { productKey: normalizedKey, viewCount: 1n },
      update: { viewCount: { increment: 1n } },
    }),
    prisma.productViewDaily.upsert({
      where: {
        productKey_day: {
          productKey: normalizedKey,
          day,
        },
      },
      create: {
        productKey: normalizedKey,
        day,
        viewCount: 1n,
      },
      update: { viewCount: { increment: 1n } },
    }),
  ])

  return { recorded: true, productKey: normalizedKey }
}

export function trackProductViewSafe(userId: number | undefined, productKey: string): void {
  if (!userId) return
  void recordProductView(userId, productKey).catch((error) => {
    log.error('ANALYTICS', error instanceof Error ? error.message : 'recordProductView failed')
  })
}

export async function listProductViewStats() {
  const [totalsRows, daily] = await Promise.all([
    prisma.productViewStat.findMany(),
    prisma.productViewDaily.findMany({
      where: {
        day: {
          gte: tehranDayDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
        },
      },
      orderBy: [{ day: 'desc' }, { viewCount: 'desc' }],
    }),
  ])

  const countByKey = new Map(totalsRows.map((row) => [row.productKey, row]))
  const totals = SHOP_PRODUCT_KEYS.map((productKey) => {
    const row = countByKey.get(productKey)
    return {
      productKey,
      viewCount: (row?.viewCount ?? 0n).toString(),
      updatedAt: (row?.updatedAt ?? new Date(0)).toISOString(),
    }
  }).sort((a, b) => Number(b.viewCount) - Number(a.viewCount))

  return {
    totals,
    daily: daily.map((row) => ({
      productKey: row.productKey,
      day: formatStoredDay(row.day),
      viewCount: row.viewCount.toString(),
    })),
  }
}
