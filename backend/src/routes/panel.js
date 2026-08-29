import { loadAuthedUser } from "../lib/auth.js";
import { readJsonBody } from "../http/body.js";
import { sendJson } from "../http/respond.js";
import { log } from "../lib/logger.js";
import { isPanelUsernameTaken } from "../db/pasarguardPanels.js";
import { normalizePanelUsername, panelUsernameError } from "../lib/panelUsername.js";
import {
  activatePanelTrial,
  activatePanelUsage,
  getPanelPurchaseOptions,
  PanelServiceError,
} from "../services/panelPurchase.service.js";

function sendRouteError(res, error) {
  const status = error.status || 500;
  if (status >= 500) log.error("api", error.stack || error.message || error);
  else log.warn("api", error.message || "request failed");

  const payload = { ok: false, error: error.message || "Request failed" };
  if (error.code) payload.code = error.code;
  sendJson(res, status, payload);
}

export async function handlePanelRoutes(req, res, path) {
  if (!path.startsWith("/api/panel")) return false;

  try {
    if (req.method === "GET" && path.startsWith("/api/panel/check-username")) {
      await loadAuthedUser(req);
      const url = new URL(req.url, "http://localhost");
      const rawUsername = url.searchParams.get("username") || "";
      const validationError = panelUsernameError(rawUsername);
      if (validationError) {
        sendJson(res, 200, {
          ok: true,
          available: false,
          reason: validationError,
          username: rawUsername,
        });
        return true;
      }

      const username = normalizePanelUsername(rawUsername);
      const taken = await isPanelUsernameTaken(username);
      if (taken) {
        sendJson(res, 200, {
          ok: true,
          available: false,
          reason: "این یوزرنیم قبلاً انتخاب شده، نام دیگری ثبت کنید",
          username,
        });
        return true;
      }

      sendJson(res, 200, {
        ok: true,
        available: true,
        message: "این یوزرنیم قابل ثبت است",
        username,
      });
      return true;
    }

    if (req.method === "GET" && path === "/api/panel/options") {
      const { telegramUser } = await loadAuthedUser(req);
      const options = await getPanelPurchaseOptions(telegramUser.id);
      sendJson(res, 200, { ok: true, ...options });
      return true;
    }

    if (req.method === "POST" && path === "/api/panel/trial") {
      const { telegramUser } = await loadAuthedUser(req, { write: true });
      const body = await readJsonBody(req);
      const result = await activatePanelTrial(telegramUser.id, body.username);
      log.event("api", `POST /api/panel/trial tg:${telegramUser.id} user:${result.credentials.username}`);
      sendJson(res, 201, { ok: true, ...result });
      return true;
    }

    if (req.method === "POST" && path === "/api/panel/usage/activate") {
      const { telegramUser } = await loadAuthedUser(req, { write: true });
      const body = await readJsonBody(req);
      const result = await activatePanelUsage(telegramUser.id, body.username);
      log.event(
        "api",
        `POST /api/panel/usage/activate tg:${telegramUser.id} user:${result.credentials.username}`,
      );
      sendJson(res, 201, { ok: true, ...result });
      return true;
    }

    return false;
  } catch (error) {
    if (error instanceof PanelServiceError || error.name === "PanelServiceError") {
      sendRouteError(res, error);
      return true;
    }
    sendRouteError(res, error);
    return true;
  }
}
