import cron from "node-cron";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { sweepAllWalletBalances } from "../services/tron/tron-sweep.service.js";

let scheduledTask = null;
let isRunning = false;

async function runWalletSweep() {
  if (isRunning) {
    logger.info("sweep", "cron skip", { reason: "busy" });
    return;
  }

  isRunning = true;

  try {
    const result = await sweepAllWalletBalances();

    logger.info("sweep", "cron tick", {
      wallets: result.wallets,
      withBalance: result.withBalance,
      swept: result.swept,
    });
  } catch (err) {
    logger.error("sweep", "cron fail", { error: err.message });
  } finally {
    isRunning = false;
  }
}

export function startWalletSweepJob() {
  if (scheduledTask) {
    return;
  }

  scheduledTask = cron.schedule(env.walletSweepCron, () => {
    runWalletSweep().catch((err) => {
      logger.error("sweep", "cron unhandled", { error: err.message });
    });
  });

  logger.info("sweep", `cron ${env.tronNetwork}`, {
    cron: env.walletSweepCron,
  });
}

export function stopWalletSweepJob() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
}
