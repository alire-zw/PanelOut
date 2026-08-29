import { checkHealth } from "./health.js";
import { logger } from "./logger.js";

const CHECK_INTERVAL_MS = 60_000;
const MAX_CONSECUTIVE_FAILURES = 3;

let timer = null;
let consecutiveFailures = 0;

async function runWatchdogTick() {
  try {
    const health = await checkHealth();

    if (health.ok) {
      if (consecutiveFailures > 0) {
        logger.info("watchdog", "dependencies recovered");
      }

      consecutiveFailures = 0;
      return;
    }

    consecutiveFailures += 1;

    logger.error("watchdog", "dependency check failed", {
      attempt: consecutiveFailures,
      postgres: health.checks.postgres,
      redis: health.checks.redis,
    });

    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      logger.fatal("watchdog", "restarting process after repeated failures");
      process.exit(1);
    }
  } catch (err) {
    consecutiveFailures += 1;
    logger.error("watchdog", "tick failed", { error: err.message });

    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      logger.fatal("watchdog", "restarting process after repeated failures");
      process.exit(1);
    }
  }
}

export function startWatchdog() {
  if (timer) {
    return;
  }

  timer = setInterval(() => {
    runWatchdogTick().catch((err) => {
      logger.error("watchdog", "unhandled tick error", { error: err.message });
    });
  }, CHECK_INTERVAL_MS);

  timer.unref?.();
  logger.info("watchdog", "started");
}

export function stopWatchdog() {
  if (!timer) {
    return;
  }

  clearInterval(timer);
  timer = null;
  consecutiveFailures = 0;
}
