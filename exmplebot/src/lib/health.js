import { prisma } from "../db/prisma.js";
import { redis } from "../db/redis.js";

export async function checkHealth() {
  const checks = {
    postgres: false,
    redis: false,
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.postgres = true;
  } catch {
    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      checks.postgres = true;
    } catch {
      checks.postgres = false;
    }
  }

  try {
    const response = await redis.ping();
    checks.redis = response === "PONG";
  } catch {
    checks.redis = false;
  }

  const ok = checks.postgres && checks.redis;

  return { ok, checks };
}
