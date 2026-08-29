import { refreshShopActivityStats } from "../db/pasarguardPanels.js";
import { log } from "../lib/logger.js";

const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

let timer = null;
let refreshInFlight = null;

async function runRefresh() {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = refreshShopActivityStats()
    .catch((error) => {
      log.error("shop", `activity refresh failed — ${error.message || error}`);
      throw error;
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

export function startShopActivityJob() {
  if (timer) return timer;

  void runRefresh();

  timer = setInterval(() => {
    void runRefresh();
  }, REFRESH_INTERVAL_MS);

  if (typeof timer.unref === "function") {
    timer.unref();
  }

  log.event("shop", "activity job started — refresh every 10m");
  return timer;
}

export function stopShopActivityJob() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
