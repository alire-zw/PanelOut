import { runPanelUsageBillingCycle } from "../services/panelUsageBilling.service.js";
import { log } from "../lib/logger.js";

const TICK_MS = 10 * 60 * 1000;

let timer = null;
let inFlight = false;

async function tick() {
  if (inFlight) {
    log.event("billing", "tick skip — busy");
    return;
  }
  inFlight = true;
  try {
    const result = await runPanelUsageBillingCycle();
    if (result.billed > 0 || result.errors > 0) {
      log.event(
        "billing",
        `tick total:${result.total} billed:${result.billed} errors:${result.errors}`,
      );
    }
  } catch (err) {
    log.error("billing", `tick fail — ${err.message || err}`);
  } finally {
    inFlight = false;
  }
}

export function startPanelUsageBillingJob() {
  if (timer) return timer;
  void tick();
  timer = setInterval(() => {
    void tick();
  }, TICK_MS);
  if (typeof timer.unref === "function") timer.unref();
  log.event("billing", "panel usage billing job started — every 10m");
  return timer;
}

export function stopPanelUsageBillingJob() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
