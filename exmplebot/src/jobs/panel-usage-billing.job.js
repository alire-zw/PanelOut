import cron from "node-cron";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { runPanelUsageBillingCycle } from "../services/panel-usage-billing.service.js";

let scheduledTask = null;
let isRunning = false;

async function runBillingJob() {
  if (isRunning) {
    logger.info("panel-usage-billing", "cron skip", { reason: "busy" });
    return;
  }

  isRunning = true;

  try {
    const result = await runPanelUsageBillingCycle();
    logger.info("panel-usage-billing", "cron tick", result);
  } catch (err) {
    logger.error("panel-usage-billing", "cron fail", { error: err.message });
  } finally {
    isRunning = false;
  }
}

export function startPanelUsageBillingJob() {
  if (scheduledTask) {
    return;
  }

  scheduledTask = cron.schedule(env.panelUsageBillingCron, () => {
    runBillingJob().catch((err) => {
      logger.error("panel-usage-billing", "cron unhandled", { error: err.message });
    });
  });

  logger.info("panel-usage-billing", "cron started", {
    cron: env.panelUsageBillingCron,
  });
}

export function stopPanelUsageBillingJob() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
}
