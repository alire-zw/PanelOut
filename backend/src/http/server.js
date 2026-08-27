import { createServer } from "node:http";
import { webhookCallback } from "grammy";
import { config } from "../config.js";
import {
  applyCors,
  sendJson,
  sendText,
  sendUnauthorized,
} from "./respond.js";
import { tryServeUpload } from "./uploads.js";
import { handleUserRoutes } from "../routes/user.js";
import { handleAdminRoutes } from "../routes/admin.js";
import { handlePaymentRoutes } from "../routes/payments.js";
import { handleWalletRoutes } from "../routes/wallet.js";
import { handleSupportRoutes } from "../routes/support.js";
import { handleChannelLockRoutes } from "../routes/channelLock.js";
import { assertWebhookSecret } from "../bot/webhook.js";
import { setBotApi } from "../bot/api.js";
import { applySecurityHeaders } from "../lib/security.js";
import { log } from "../lib/logger.js";

export function createAppServer(bot) {
  setBotApi(bot.api);
  const handleUpdate = webhookCallback(bot, "http");
  const origins = config.corsOrigins;

  return createServer(async (req, res) => {
    applySecurityHeaders(res);

    const path = (req.url || "/").split("?")[0];
    const isWebhookPath =
      path === config.webhookPath ||
      (config.webhookPath === "/" && (path === "/" || path === ""));

    applyCors(req, res, { origins });

    if (req.method === "OPTIONS") {
      // Only answer preflight for allowlisted origins
      if (req.headers.origin && !origins.includes(req.headers.origin)) {
        sendUnauthorized(res);
        return;
      }
      res.writeHead(204);
      res.end();
      return;
    }

    // Telegram webhook — secret token required, no Mini App auth
    if (req.method === "POST" && isWebhookPath) {
      try {
        assertWebhookSecret(req);
      } catch {
        log.warn("webhook", "rejected — bad secret");
        sendUnauthorized(res);
        return;
      }

      handleUpdate(req, res).catch((error) => {
        log.error("webhook", error);
        if (!res.headersSent) {
          sendText(res, 500, "Internal Server Error");
        }
      });
      return;
    }

    // Authenticated file access only
    if (await tryServeUpload(req, res, path)) return;

    if (req.method === "GET" && (path === "/" || path === "")) {
      res.writeHead(302, { Location: config.telegramAppUrl });
      res.end();
      return;
    }

    // Minimal health — no dependency details
    if (req.method === "GET" && path === "/health") {
      sendJson(res, 200, { ok: true });
      return;
    }

    // Everything under /api requires Telegram Mini App auth inside handlers.
    // Unknown /api paths still go through handlers then fall to stealth 404.
    if (path.startsWith("/api/")) {
      try {
        if (await handleUserRoutes(req, res, path)) return;
        if (await handleAdminRoutes(req, res, path)) return;
        if (await handlePaymentRoutes(req, res, path)) return;
        if (await handleWalletRoutes(req, res, path)) return;
        if (await handleSupportRoutes(req, res, path)) return;
        if (await handleChannelLockRoutes(req, res, path)) return;
      } catch (error) {
        const status = error.status || 500;
        if (status === 429) {
          sendJson(
            res,
            429,
            { ok: false, error: "Too many requests" },
            { "retry-after": String(error.retryAfterSec || 60) },
          );
          return;
        }
        if (status === 401 || status === 403) {
          sendUnauthorized(res);
          return;
        }
        log.error("http", error);
        if (!res.headersSent) {
          sendJson(res, 500, { ok: false, error: "Internal Server Error" });
        }
        return;
      }

      // Stealth: do not advertise which API routes exist
      sendUnauthorized(res);
      return;
    }

    sendText(res, 404, "Not Found");
  });
}
