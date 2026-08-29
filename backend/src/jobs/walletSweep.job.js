import cron from "node-cron";
import { config } from "../config.js";
import { log } from "../lib/logger.js";
import { sweepAllWalletBalances } from "../services/tron/tron-sweep.service.js";

let scheduledTask = null;
let isRunning = false;

async function runWalletSweep() {
  if (isRunning) {
    log.info("sweep", "skip (busy)");
    return;
  }

  isRunning = true;

  try {
    const result = await sweepAllWalletBalances();
    log.event("sweep", "tick", result);
  } catch (err) {
    log.error("sweep", "fail", { error: err.message });
  } finally {
    isRunning = false;
  }
}

export function startWalletSweepJob() {
  if (!config.tronConfigured) {
    log.warn("sweep", "disabled — missing TRON env");
    return;
  }

  if (scheduledTask) {
    return;
  }

  scheduledTask = cron.schedule(config.walletSweepCron, () => {
    runWalletSweep().catch((err) => {
      log.error("sweep", "unhandled", { error: err.message });
    });
  });

  log.service("TRON sweep", config.tronNetwork, { cron: config.walletSweepCron });
}

export function stopWalletSweepJob() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
}
