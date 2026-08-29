import Redis from "ioredis";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

export const redis = new Redis(env.redisUrl, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  enableReadyCheck: true,
  retryStrategy(times) {
    const delay = Math.min(times * 500, 10_000);
    return delay;
  },
  reconnectOnError(err) {
    const message = String(err?.message || "").toLowerCase();
    return /readonly|econnreset|econnrefused|etimedout|closed/.test(message);
  },
});

redis.on("error", (err) => {
  logger.error("redis", err.message);
});

redis.on("reconnecting", (delay) => {
  logger.warn("redis", "reconnecting", { delayMs: delay });
});

redis.on("connect", () => {
  logger.info("redis", "connected");
});

redis.on("close", () => {
  logger.warn("redis", "connection closed");
});

export async function connectRedis() {
  await redis.connect();
}

export async function disconnectRedis() {
  await redis.quit();
  logger.info("redis", "Disconnected");
}
