import { logger } from "./logger.js";

export function registerProcessGuards() {
  process.on("unhandledRejection", (reason) => {
    const message =
      reason instanceof Error ? reason.message : String(reason ?? "unknown");

    logger.error("app", "unhandledRejection", { error: message });
  });

  process.on("uncaughtException", (err) => {
    logger.fatal("app", `uncaughtException: ${err.message}`);
    process.exit(1);
  });
}
