import { redis } from "../db/redis.js";
import { getClientIp } from "./security.js";

/**
 * Sliding window counter in Redis.
 * @returns {{ allowed: boolean, remaining: number, retryAfterSec: number }}
 */
export async function consumeRateLimit(key, { limit, windowSec }) {
  const redisKey = `rl:${key}`;
  const count = await redis.incr(redisKey);
  if (count === 1) {
    await redis.expire(redisKey, windowSec);
  }

  const ttl = await redis.ttl(redisKey);
  const retryAfterSec = ttl > 0 ? ttl : windowSec;

  if (count > limit) {
    return { allowed: false, remaining: 0, retryAfterSec };
  }

  return {
    allowed: true,
    remaining: Math.max(0, limit - count),
    retryAfterSec: 0,
  };
}

export async function enforceRateLimit(req, scope, { limit, windowSec }) {
  const ip = getClientIp(req);
  const result = await consumeRateLimit(`${scope}:${ip}`, { limit, windowSec });
  if (!result.allowed) {
    throw Object.assign(new Error("Too many requests"), {
      status: 429,
      retryAfterSec: result.retryAfterSec,
    });
  }
  return result;
}

export async function enforceUserRateLimit(telegramId, scope, { limit, windowSec }) {
  const result = await consumeRateLimit(`${scope}:tg:${telegramId}`, {
    limit,
    windowSec,
  });
  if (!result.allowed) {
    throw Object.assign(new Error("Too many requests"), {
      status: 429,
      retryAfterSec: result.retryAfterSec,
    });
  }
  return result;
}

/** Track failed auth attempts per IP — temporary lockout. */
export async function registerAuthFailure(req) {
  const ip = getClientIp(req);
  const result = await consumeRateLimit(`authfail:${ip}`, {
    limit: 40,
    windowSec: 600,
  });
  return result;
}

export async function assertNotAuthLocked(req) {
  const ip = getClientIp(req);
  const key = `rl:authfail:${ip}`;
  const count = Number((await redis.get(key)) || 0);
  if (count >= 40) {
    const ttl = await redis.ttl(key);
    throw Object.assign(new Error("Unauthorized"), {
      status: 401,
      retryAfterSec: ttl > 0 ? ttl : 600,
      code: "AUTH_LOCKED",
    });
  }
}
