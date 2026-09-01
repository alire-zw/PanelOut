import { runOutboundVolumeAlertCycle } from "../services/outboundVolumeAlert.service.js";
import { log } from "../lib/logger.js";

const TICK_MS = 5 * 60 * 1000;

let timer = null;
let inFlight = false;

async function tick() {
  if (inFlight) return;
  inFlight = true;
  try {
    const result = await runOutboundVolumeAlertCycle();
    if (result.notified > 0 || result.errors > 0) {
      log.event(
        "outbound-alert",
        `tick total:${result.total} notified:${result.notified} errors:${result.errors}`,
      );
    }
  } catch (err) {
    log.error("outbound-alert", `tick fail — ${err.message || err}`);
  } finally {
    inFlight = false;
  }
}

export function startOutboundVolumeAlertJob() {
  if (timer) return timer;
  void tick();
  timer = setInterval(() => {
    void tick();
  }, TICK_MS);
  if (typeof timer.unref === "function") timer.unref();
  log.event("outbound-alert", "job started — every 5m");
  return timer;
}

export function stopOutboundVolumeAlertJob() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
