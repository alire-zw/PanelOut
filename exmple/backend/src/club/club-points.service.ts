import { prisma } from '../db/client.js'
import { redis } from '../redis/client.js'
import { serializeUser } from '../users/user.serializer.js'

/** هر ۱۰۰٬۰۰۰ تومان خرید موفق = ۱۰ امتیاز کلاب */
export const CLUB_POINTS_UNIT_TOMAN = 100_000
export const CLUB_POINTS_PER_UNIT = 10
const CLUB_POINTS_CACHE_TTL_SECONDS = 60 * 60 * 24 * 7

function clubPointsCacheKey(userId: number): string {
  return `club:points:${userId}`
}

export function calculateClubPoints(totalPurchaseToman: number): number {
  if (!Number.isFinite(totalPurchaseToman) || totalPurchaseToman <= 0) {
    return 0
  }

  return Math.floor(totalPurchaseToman / CLUB_POINTS_UNIT_TOMAN) * CLUB_POINTS_PER_UNIT
}

async function setClubPointsCache(userId: number, clubPoints: number): Promise<void> {
  await redis.set(clubPointsCacheKey(userId), String(clubPoints), 'EX', CLUB_POINTS_CACHE_TTL_SECONDS)
}

export async function getUserCompletedPurchaseTotalToman(userId: number): Promise<number> {
  const aggregate = await prisma.order.aggregate({
    where: {
      userId,
      status: 'completed',
    },
    _sum: {
      amountToman: true,
    },
  })

  return Number(aggregate._sum.amountToman ?? 0n)
}

/** Fast path: Redis → DB (and warm Redis). Does not recompute from orders. */
export async function getClubPoints(userId: number): Promise<number> {
  try {
    const cached = await redis.get(clubPointsCacheKey(userId))
    if (cached !== null) {
      const parsed = Number.parseInt(cached, 10)
      if (Number.isFinite(parsed) && parsed >= 0) {
        return parsed
      }
    }
  } catch {
    // fall through to DB
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { clubPoints: true },
  })
  const clubPoints = user?.clubPoints ?? 0

  try {
    await setClubPointsCache(userId, clubPoints)
  } catch {
    // ignore cache write failures
  }

  return clubPoints
}

export async function syncUserClubPoints(userId: number) {
  const totalPurchaseToman = await getUserCompletedPurchaseTotalToman(userId)
  const clubPoints = calculateClubPoints(totalPurchaseToman)

  const user = await prisma.user.update({
    where: { id: userId },
    data: { clubPoints },
  })

  try {
    await setClubPointsCache(userId, clubPoints)
  } catch {
    // ignore cache write failures
  }

  return {
    user: serializeUser(user),
    clubPoints,
    totalPurchaseToman,
    pointsPerUnit: CLUB_POINTS_PER_UNIT,
    unitToman: CLUB_POINTS_UNIT_TOMAN,
  }
}

export async function syncAllUsersClubPoints() {
  const users = await prisma.user.findMany({
    select: { id: true },
  })

  let updated = 0
  for (const user of users) {
    await syncUserClubPoints(user.id)
    updated += 1
  }

  return { updated }
}
