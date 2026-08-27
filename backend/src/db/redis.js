import Redis from "ioredis";
import { config } from "../config.js";

export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

export async function pingRedis() {
  const result = await redis.ping();
  return result === "PONG";
}

export async function closeRedis() {
  if (redis.status === "end" || redis.status === "wait") return;
  try {
    await redis.quit();
  } catch {
    redis.disconnect();
  }
}
