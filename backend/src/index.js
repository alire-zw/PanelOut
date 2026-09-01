import { config } from "./config.js";
import { createBot } from "./bot/index.js";
import { ensureWebhook } from "./bot/webhook.js";
import { createAppServer } from "./http/server.js";
import {
  initPostgres,
  pingPostgres,
  closePostgres,
  getDatabaseName,
} from "./db/postgres.js";
import { ensureSchema } from "./db/schema.js";
import { redis, pingRedis, closeRedis } from "./db/redis.js";
import { startShopActivityJob, stopShopActivityJob } from "./jobs/shopActivity.job.js";
import {
  startPanelUsageBillingJob,
  stopPanelUsageBillingJob,
} from "./jobs/panelUsageBilling.job.js";
import {
  startOutboundUsageBillingJob,
  stopOutboundUsageBillingJob,
} from "./jobs/outboundUsageBilling.job.js";
import {
  startOutboundVolumeAlertJob,
  stopOutboundVolumeAlertJob,
} from "./jobs/outboundVolumeAlert.job.js";
import {
  startDepositMonitorJob,
  stopDepositMonitorJob,
} from "./jobs/depositMonitor.job.js";
import { startWalletSweepJob, stopWalletSweepJob } from "./jobs/walletSweep.job.js";
import { log } from "./lib/logger.js";

async function bootstrap() {
  log.header("PanelOut", "backend");

  await initPostgres();
  await redis.connect();

  const [pgOk, redisOk] = await Promise.all([pingPostgres(), pingRedis()]);
  if (!pgOk || !redisOk) {
    throw new Error(`health check failed — postgres=${pgOk} redis=${redisOk}`);
  }

  log.service("Postgres", getDatabaseName(), pgOk);
  log.service("Redis", "ready", redisOk);

  await ensureSchema();

  startShopActivityJob();
  startPanelUsageBillingJob();
  startOutboundUsageBillingJob();
  startOutboundVolumeAlertJob();
  startDepositMonitorJob();
  startWalletSweepJob();

  const bot = createBot();
  const webhook = await ensureWebhook(bot, config.webhookUrl);
  const server = createAppServer(bot);

  const shutdown = async (signal) => {
    log.warn("shutdown", signal);
    stopShopActivityJob();
    stopPanelUsageBillingJob();
    stopOutboundUsageBillingJob();
    stopOutboundVolumeAlertJob();
    stopDepositMonitorJob();
    stopWalletSweepJob();
    await new Promise((resolve) => server.close(resolve));
    await Promise.allSettled([closePostgres(), closeRedis()]);
    log.event("stopped");
    process.exit(0);
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));

  await new Promise((resolve, reject) => {
    server.listen(config.port, () => resolve());
    server.on("error", reject);
  });

  const me = await bot.api.getMe();
  log.service("Webhook", webhook.updated ? "updated" : "synced");
  log.service("HTTP", `:${config.port}`);
  log.service("Hook", config.webhookPath);
  log.service("API", "/api/* · tma-only");
  log.service("Bot", `@${me.username}`);
  log.ready(config.baseUrl);
}

bootstrap().catch(async (error) => {
  log.error("boot", error);
  await Promise.allSettled([closePostgres(), closeRedis()]);
  process.exit(1);
});
