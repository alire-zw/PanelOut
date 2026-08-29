import { MANAGE_SERVICES_LIVE_CACHE_TTL_SECONDS } from "../constants/manage-services.js";
import { redis } from "../db/redis.js";

const CACHE_PREFIX = "manage-services:live:";

function cacheKey(subscriptionId) {
  return `${CACHE_PREFIX}${subscriptionId}`;
}

export async function getCachedManageServiceLive(subscriptionId) {
  const raw = await redis.get(cacheKey(subscriptionId));

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    await redis.del(cacheKey(subscriptionId));
    return null;
  }
}

export async function setCachedManageServiceLive(subscriptionId, live) {
  if (!live?.success) {
    return;
  }

  await redis.set(
    cacheKey(subscriptionId),
    JSON.stringify(live),
    "EX",
    MANAGE_SERVICES_LIVE_CACHE_TTL_SECONDS,
  );
}

export async function invalidateCachedManageServiceLive(subscriptionId) {
  await redis.del(cacheKey(subscriptionId));
}
