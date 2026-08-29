import cron from "node-cron";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { runOutboundUsageBillingCycle } from "../services/outbound-usage-billing.service.js";

let scheduledTask = null;
let isRunning = false;

async function runBillingJob() {
  if (isRunning) {
    logger.info("outbound-usage-billing", "cron skip", { reason: "busy" });
    return;
  }

  isRunning = true;

  try {
    const result = await runOutboundUsageBillingCycle();

    logger.info("outbound-usage-billing", "cron tick", result);
  } catch (err) {
    logger.error("outbound-usage-billing", "cron fail", { error: err.message });
  } finally {
    isRunning = false;
  }
}

export function startOutboundUsageBillingJob() {
  if (scheduledTask) {
    return;
  }

  scheduledTask = cron.schedule(env.outboundUsageBillingCron, () => {
    runBillingJob().catch((err) => {
      logger.error("outbound-usage-billing", "cron unhandled", { error: err.message });
    });
  });

  logger.info("outbound-usage-billing", "cron started", {
    cron: env.outboundUsageBillingCron,
  });
}

export function stopOutboundUsageBillingJob() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
}
