import cron from "node-cron";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { processAllWalletDeposits } from "../services/tron/deposit-processor.service.js";

let scheduledTask = null;
let isRunning = false;

async function runDepositMonitor() {
  if (isRunning) {
    logger.info("tron", "monitor skip", { reason: "busy" });
    return;
  }

  isRunning = true;

  try {
    const result = await processAllWalletDeposits();

    logger.info("tron", "monitor tick", {
      wallets: result.wallets,
      credited: result.credited,
    });
  } catch (err) {
    logger.error("tron", "monitor fail", { error: err.message });
  } finally {
    isRunning = false;
  }
}

export function startDepositMonitorJob() {
  if (scheduledTask) {
    return;
  }

  scheduledTask = cron.schedule(env.depositMonitorCron, () => {
    runDepositMonitor().catch((err) => {
      logger.error("tron", "monitor unhandled", { error: err.message });
    });
  });

  logger.info("tron", `monitor ${env.tronNetwork}`, {
    cron: env.depositMonitorCron,
    host: env.tronFullHost,
  });
  runDepositMonitor();
}

export function stopDepositMonitorJob() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
}
