import { createHash } from "node:crypto";
import { log } from "../lib/logger.js";
import { config } from "../config.js";
import { redis } from "../db/redis.js";
import { safeEqualString } from "../lib/security.js";

const SECRET_MARKER_KEY = "webhook:secret_sha256";
const ALLOWED_UPDATES = ["message", "callback_query", "my_chat_member"];

function secretHash() {
  return createHash("sha256").update(config.webhookSecret).digest("hex");
}

function updatesFingerprint() {
  return ALLOWED_UPDATES.join(",");
}

/**
 * Only calls setWebhook when URL, secret, or allowed_updates need updating.
 */
export async function ensureWebhook(bot, webhookUrl) {
  const info = await bot.api.getWebhookInfo();
  const current = (info.url || "").replace(/\/+$/, "");
  const expected = webhookUrl.replace(/\/+$/, "");
  const marker = await redis.get(SECRET_MARKER_KEY);
  const hash = `${secretHash()}|${updatesFingerprint()}`;
  const force = process.env.FORCE_WEBHOOK_SYNC === "1";
  const secretChanged = marker !== hash;

  if (current === expected && !secretChanged && !force) {
    if (info.pending_update_count > 0) {
      log.note("webhook pending", `${info.pending_update_count} updates`);
    }
    return { updated: false, info };
  }

  log.note(
    "webhook updating",
    `${current || "none"} → ${expected}${secretChanged ? " · secret/updates rotate" : ""}`,
  );

  await bot.api.setWebhook(expected, {
    secret_token: config.webhookSecret,
    drop_pending_updates: false,
    allowed_updates: ALLOWED_UPDATES,
  });

  await redis.set(SECRET_MARKER_KEY, hash);
  return { updated: true, info };
}

export function assertWebhookSecret(req) {
  const header = req.headers["x-telegram-bot-api-secret-token"];
  if (!safeEqualString(header, config.webhookSecret)) {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }
}
