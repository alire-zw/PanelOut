import { prisma } from "../db/prisma.js";
import { redis } from "../db/redis.js";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

const REQUIRED_TABLES = ["users", "panel_settings", "subscription_pricing"];

const CHECK_LABELS = {
  environment: "env",
  postgresql: "pg",
  database_tables: "tables",
  redis: "redis",
  telegram_api: "tg",
};

async function runCheck(name, fn) {
  const label = CHECK_LABELS[name] ?? name;

  try {
    const detail = await fn();
    const suffix = detail?.suffix ? ` ${detail.suffix}` : "";
    logger.info("startup", `${label} ok${suffix}`);
    return { name, ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("startup", `${label} fail`, { error: message });
    return { name, ok: false, error: message };
  }
}

function checkEnvironment() {
  const required = [
    "BOT_TOKEN",
    "WEBHOOK_URL",
    "WEBHOOK_SECRET",
    "DATABASE_URL",
    "REDIS_URL",
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`missing ${missing.join(", ")}`);
  }

  return { suffix: `:${env.port} admins=${env.adminIds.size}` };
}

async function checkPostgres() {
  await prisma.$queryRaw`SELECT 1`;
}

async function checkDatabaseTables() {
  const tables = await prisma.$queryRaw`
    SELECT table_name::text AS name
    FROM information_schema.tables
    WHERE table_schema = 'public'
  `;

  const existing = new Set(tables.map((row) => row.name));
  const missing = REQUIRED_TABLES.filter((table) => !existing.has(table));

  if (missing.length > 0) {
    throw new Error(`missing ${missing.join(", ")}`);
  }
}

async function checkRedis() {
  const response = await redis.ping();

  if (response !== "PONG") {
    throw new Error(`bad response ${response}`);
  }
}

async function checkTelegramBot(bot) {
  const me = await bot.api.getMe();
  return { suffix: `@${me.username}` };
}

export async function runStartupChecks(bot) {
  logger.info("startup", "checks...");

  const results = await Promise.all([
    runCheck("environment", async () => checkEnvironment()),
    runCheck("postgresql", checkPostgres),
    runCheck("database_tables", checkDatabaseTables),
    runCheck("redis", checkRedis),
    runCheck("telegram_api", () => checkTelegramBot(bot)),
  ]);

  const failed = results.filter((result) => !result.ok);

  if (failed.length > 0) {
    const names = failed.map((result) => CHECK_LABELS[result.name] ?? result.name).join(", ");
    throw new Error(`failed: ${names}`);
  }

  logger.info("startup", "all ok");
}
