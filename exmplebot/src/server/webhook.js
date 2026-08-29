import { GrammyError } from "grammy";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

const webhookOptions = {
  secret_token: env.webhookSecret,
  allowed_updates: ["message", "callback_query"],
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(err) {
  return err instanceof GrammyError && err.error_code === 429;
}

async function setWebhookWithRetry(bot) {
  const maxAttempts = 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await bot.api.setWebhook(env.webhookUrl, webhookOptions);
      return;
    } catch (err) {
      if (!isRateLimitError(err) || attempt === maxAttempts) {
        throw err;
      }

      const retryAfter = (err.parameters?.retry_after ?? 1) * 1000;
      logger.warn("webhook", `retry ${attempt}/${maxAttempts} in ${retryAfter}ms`);
      await sleep(retryAfter);
    }
  }
}

function isWebhookConfigured(info) {
  const allowed = webhookOptions.allowed_updates ?? [];
  const current = info.allowed_updates ?? [];

  return (
    info.url === env.webhookUrl &&
    allowed.length === current.length &&
    allowed.every((update, index) => update === current[index])
  );
}

export async function setupWebhook(bot) {
  await ensureWebhookHealth(bot);
}

export async function ensureWebhookHealth(bot) {
  const info = await bot.api.getWebhookInfo();
  const configured = isWebhookConfigured(info);
  const hasRecentError =
    info.last_error_date != null &&
    Date.now() / 1000 - info.last_error_date < 3600;

  if (configured && !hasRecentError) {
    return { reregistered: false, info };
  }

  if (!configured) {
    logger.warn("webhook", "misconfigured", {
      current: info.url || "(empty)",
      expected: env.webhookUrl,
    });
  }

  if (hasRecentError) {
    logger.warn("webhook", "recent delivery error", {
      message: info.last_error_message,
    });
  }

  await setWebhookWithRetry(bot);
  logger.info("webhook", configured ? "refreshed" : "registered");

  return { reregistered: true, info };
}
