import cron from "node-cron";
import { config } from "../config.js";
import { log } from "../lib/logger.js";
import { processAllWalletDeposits } from "../services/tron/deposit-processor.service.js";

let scheduledTask = null;
let isRunning = false;

async function runDepositMonitor() {
  if (isRunning) {
    log.info("tron", "monitor skip (busy)");
    return;
  }

  isRunning = true;

  try {
    const result = await processAllWalletDeposits();
    log.event("tron", "monitor tick", {
      wallets: result.wallets,
      credited: result.credited,
    });
  } catch (err) {
    log.error("tron", "monitor fail", { error: err.message });
  } finally {
    isRunning = false;
  }
}

export function startDepositMonitorJob() {
  if (!config.tronConfigured) {
    log.warn("tron", "monitor disabled — missing TRON env");
    return;
  }

  if (scheduledTask) {
    return;
  }

  scheduledTask = cron.schedule(config.depositMonitorCron, () => {
    runDepositMonitor().catch((err) => {
      log.error("tron", "monitor unhandled", { error: err.message });
    });
  });

  log.service("TRON monitor", config.tronNetwork, {
    cron: config.depositMonitorCron,
    host: config.tronFullHost,
  });
  runDepositMonitor();
}

export function stopDepositMonitorJob() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
}
