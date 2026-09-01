import { runOutboundUsageBillingCycle } from "../services/outboundUsageBilling.service.js";
import { log } from "../lib/logger.js";

const TICK_MS = 20 * 1000;

let timer = null;
let inFlight = false;

async function tick() {
  if (inFlight) return;
  inFlight = true;
  try {
    const result = await runOutboundUsageBillingCycle();
    if (result.billed > 0 || result.errors > 0) {
      log.event(
        "outbound-billing",
        `tick total:${result.total} billed:${result.billed} errors:${result.errors}`,
      );
    }
  } catch (err) {
    log.error("outbound-billing", `tick fail — ${err.message || err}`);
  } finally {
    inFlight = false;
  }
}

export function startOutboundUsageBillingJob() {
  if (timer) return timer;
  void tick();
  timer = setInterval(() => {
    void tick();
  }, TICK_MS);
  if (typeof timer.unref === "function") timer.unref();
  log.event("outbound-billing", "job started — every 20s");
  return timer;
}

export function stopOutboundUsageBillingJob() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
