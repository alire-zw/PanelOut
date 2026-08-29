import cron from "node-cron";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { ensureWebhookHealth } from "../server/webhook.js";

let scheduledTask = null;
let isRunning = false;

async function runWebhookHealthCheck(bot) {
  if (isRunning) {
    return;
  }

  isRunning = true;

  try {
    const result = await ensureWebhookHealth(bot);

    if (result.reregistered) {
      logger.warn("webhook", "re-registered after health check");
    }
  } catch (err) {
    logger.error("webhook", "health check failed", { error: err.message });
  } finally {
    isRunning = false;
  }
}

export function startWebhookHealthJob(bot) {
  if (scheduledTask) {
    return;
  }

  scheduledTask = cron.schedule(env.webhookHealthCron, () => {
    runWebhookHealthCheck(bot).catch((err) => {
      logger.error("webhook", "health job unhandled", { error: err.message });
    });
  });

  logger.info("webhook", "health cron started", { cron: env.webhookHealthCron });
}

export function stopWebhookHealthJob() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
}
