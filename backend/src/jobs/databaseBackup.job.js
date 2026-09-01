import { config } from "../config.js";
import { log } from "../lib/logger.js";
import { sendDatabaseBackupToAdminReport } from "../services/databaseBackupReport.service.js";

let timer = null;
let backupInFlight = null;

async function runBackup(reason) {
  if (backupInFlight) {
    log.event("backup", `skip — previous backup in progress (${reason})`);
    return backupInFlight;
  }

  backupInFlight = sendDatabaseBackupToAdminReport({ reason })
    .catch((error) => {
      log.error("backup", `job failed — ${error.message || error}`);
      throw error;
    })
    .finally(() => {
      backupInFlight = null;
    });

  return backupInFlight;
}

export function startDatabaseBackupJob() {
  if (timer) return timer;
  if (!config.databaseBackupEnabled) {
    log.event("backup", "job not started — disabled");
    return null;
  }

  void runBackup("startup");

  timer = setInterval(() => {
    void runBackup("scheduled");
  }, config.databaseBackupIntervalMs);

  if (typeof timer.unref === "function") {
    timer.unref();
  }

  const intervalMinutes = Math.round(config.databaseBackupIntervalMs / 60_000);
  log.event("backup", `job started — every ${intervalMinutes}m + on startup`);
  return timer;
}

export function stopDatabaseBackupJob() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
