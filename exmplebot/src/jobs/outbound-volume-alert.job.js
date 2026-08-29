import cron from "node-cron";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { runOutboundVolumeAlertCycle } from "../services/outbound-volume-alert.service.js";

let scheduledTask = null;
let isRunning = false;

async function runAlertJob() {
  if (isRunning) {
    logger.info("outbound-volume-alert", "cron skip", { reason: "busy" });
    return;
  }

  isRunning = true;

  try {
    const result = await runOutboundVolumeAlertCycle();

    if (result.notified > 0 || result.errors > 0) {
      logger.info("outbound-volume-alert", "cron tick", result);
    }
  } catch (err) {
    logger.error("outbound-volume-alert", "cron fail", { error: err.message });
  } finally {
    isRunning = false;
  }
}

export function startOutboundVolumeAlertJob() {
  if (scheduledTask) {
    return;
  }

  scheduledTask = cron.schedule(env.outboundVolumeAlertCron, () => {
    runAlertJob().catch((err) => {
      logger.error("outbound-volume-alert", "cron unhandled", { error: err.message });
    });
  });

  logger.info("outbound-volume-alert", "cron started", {
    cron: env.outboundVolumeAlertCron,
  });
}

export function stopOutboundVolumeAlertJob() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
}
