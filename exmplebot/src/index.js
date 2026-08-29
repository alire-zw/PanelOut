import { createBot } from "./bot/bot.js";
import { setBotInstance } from "./bot/instance.js";
import { connectDatabase, disconnectDatabase } from "./db/prisma.js";
import { connectRedis, disconnectRedis } from "./db/redis.js";
import { createServer } from "./server/app.js";
import { setupWebhook } from "./server/webhook.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { registerProcessGuards } from "./lib/process-guards.js";
import { runStartupChecks } from "./lib/startup-check.js";
import { startWatchdog, stopWatchdog } from "./lib/watchdog.js";
import {
  startDepositMonitorJob,
  stopDepositMonitorJob,
} from "./jobs/deposit-monitor.job.js";
import {
  startWalletSweepJob,
  stopWalletSweepJob,
} from "./jobs/wallet-sweep.job.js";
import {
  startOutboundUsageBillingJob,
  stopOutboundUsageBillingJob,
} from "./jobs/outbound-usage-billing.job.js";
import {
  startPanelUsageBillingJob,
  stopPanelUsageBillingJob,
} from "./jobs/panel-usage-billing.job.js";
import {
  startOutboundVolumeAlertJob,
  stopOutboundVolumeAlertJob,
} from "./jobs/outbound-volume-alert.job.js";
import {
  startWebhookHealthJob,
  stopWebhookHealthJob,
} from "./jobs/webhook-health.job.js";

registerProcessGuards();

async function shutdown() {
  await disconnectDatabase();
  await disconnectRedis();
}

async function main() {
  logger.info("app", "starting");

  await connectDatabase();
  await connectRedis();

  const bot = createBot();
  setBotInstance(bot);
  await runStartupChecks(bot);

  const app = createServer(bot);
  await setupWebhook(bot);

  const server = app.listen(env.port, () => {
    logger.info("server", `listen :${env.port}`);
  });

  server.on("error", (err) => {
    logger.fatal("server", err.message);
    process.exit(1);
  });

  startDepositMonitorJob();
  startWalletSweepJob();
  startOutboundUsageBillingJob();
  startPanelUsageBillingJob();
  startOutboundVolumeAlertJob();
  startWebhookHealthJob(bot);
  startWatchdog();

  const handleShutdown = async () => {
    logger.info("app", "shutdown");
    stopWatchdog();
    stopWebhookHealthJob();
    stopDepositMonitorJob();
    stopWalletSweepJob();
    stopOutboundUsageBillingJob();
    stopPanelUsageBillingJob();
    stopOutboundVolumeAlertJob();

    await new Promise((resolve) => {
      server.close(() => resolve());
    });

    await shutdown();
    process.exit(0);
  };

  process.on("SIGINT", handleShutdown);
  process.on("SIGTERM", handleShutdown);
}

main().catch(async (err) => {
  logger.fatal("app", `failed: ${err.message}`);
  await shutdown().catch(() => {});
  process.exit(1);
});
