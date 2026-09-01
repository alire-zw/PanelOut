import { InputFile } from "grammy";
import { getBotApi } from "../bot/api.js";
import { config } from "../config.js";
import { getActiveAdminSystemChannel } from "../db/systemChannels.js";
import { createDatabaseBackupGzip } from "../lib/databaseDump.js";
import { log } from "../lib/logger.js";

const REASON_LABELS = {
  startup: "Application restart",
  scheduled: "Scheduled (every 1 hour)",
};

function boldLabel(label) {
  return `<b>${escapeHtml(label)}</b>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatTehranTime(dateInput = new Date()) {
  const date = dateInput ? new Date(dateInput) : new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}/${get("month")}/${get("day")} - ${get("hour")}:${get("minute")}:${get("second")}`;
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

function buildBackupCaption({ database, reason, compressedBytes, uncompressedBytes }) {
  const reasonLabel = REASON_LABELS[reason] || reason;
  return [
    `🗄 ${boldLabel("Database Backup")}`,
    "",
    `⏳ ${boldLabel("Time:")} ${escapeHtml(formatTehranTime())}`,
    `🗃 ${boldLabel("Database:")} <code>${escapeHtml(database)}</code>`,
    `📦 ${boldLabel("Compressed:")} ${escapeHtml(formatBytes(compressedBytes))}`,
    `📄 ${boldLabel("Raw SQL:")} ${escapeHtml(formatBytes(uncompressedBytes))}`,
    `📌 ${boldLabel("Trigger:")} ${escapeHtml(reasonLabel)}`,
  ].join("\n");
}

async function notifyBackupFailure(chatId, message) {
  try {
    await getBotApi().sendMessage(Number(chatId), message, { parse_mode: "HTML" });
  } catch (error) {
    log.error("backup", `failure notify failed — ${error.message || error}`);
  }
}

export async function sendDatabaseBackupToAdminReport({ reason = "scheduled" } = {}) {
  if (!config.databaseBackupEnabled) {
    log.event("backup", "skipped — disabled");
    return { ok: false, reason: "disabled" };
  }

  const channel = await getActiveAdminSystemChannel("admin_report");
  if (!channel?.chatId) {
    log.event("backup", "skipped — admin_report channel missing");
    return { ok: false, reason: "no_channel" };
  }

  const chatId = Number(channel.chatId);

  try {
    const backup = await createDatabaseBackupGzip();
    const caption = buildBackupCaption({
      database: backup.database,
      reason,
      compressedBytes: backup.compressedBytes,
      uncompressedBytes: backup.uncompressedBytes,
    });

    await getBotApi().sendDocument(chatId, new InputFile(backup.buffer, backup.filename), {
      caption,
      parse_mode: "HTML",
    });

    log.event(
      "backup",
      `sent — ${backup.filename} (${formatBytes(backup.compressedBytes)}) · ${reason}`,
    );

    return { ok: true, filename: backup.filename };
  } catch (error) {
    const message = [
      `⚠️ ${boldLabel("Database Backup Failed")}`,
      "",
      `⏳ ${boldLabel("Time:")} ${escapeHtml(formatTehranTime())}`,
      `📌 ${boldLabel("Trigger:")} ${escapeHtml(REASON_LABELS[reason] || reason)}`,
      `❌ ${boldLabel("Error:")} ${escapeHtml(error.message || error)}`,
    ].join("\n");

    await notifyBackupFailure(chatId, message);
    log.error("backup", error.message || error);
    return { ok: false, reason: "error", error };
  }
}
