import { loadAuthedUser } from "../lib/auth.js";
import { readJsonBody } from "../http/body.js";
import { sendJson } from "../http/respond.js";
import { log } from "../lib/logger.js";
import { isPanelUsernameTaken } from "../db/pasarguardPanels.js";
import { normalizePanelUsername, panelUsernameError } from "../lib/panelUsername.js";
import {
  activatePanelReseller,
  activatePanelTrial,
  activatePanelUsage,
  allocatePanelBalance,
  importExistingPanel,
  previewExistingPanel,
  getMyPanels,
  getPanelPurchaseOptions,
  PanelServiceError,
  resetPanelPassword,
} from "../services/panelPurchase.service.js";
import { togglePanelSubscription } from "../services/panelUsageBilling.service.js";

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

    if (req.method === "GET" && path === "/api/panel/mine") {
      const { telegramUser } = await loadAuthedUser(req);
      const payload = await getMyPanels(telegramUser.id);
      sendJson(res, 200, { ok: true, ...payload });
      return true;
    }

    if (req.method === "GET" && path === "/api/panel/mine/sync") {
      const { telegramUser } = await loadAuthedUser(req);
      const url = new URL(req.url, "http://localhost");
      const version = url.searchParams.get("version") || "";
      const { syncMyPanels } = await import("../db/userPanelsCache.js");
      const result = await syncMyPanels(telegramUser.id, version);
      log.event(
        "api",
        `GET /api/panel/mine/sync tg:${telegramUser.id} changed:${result.changed}`,
      );
      sendJson(res, 200, { ok: true, ...result });
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
      const result = await activatePanelUsage(telegramUser.id, body.username, {
        mode: body.mode,
      });
      log.event(
        "api",
        `POST /api/panel/usage/activate tg:${telegramUser.id} user:${result.credentials.username} mode:${result.credentials.upgradedFromTrial ? "upgrade" : "new"}`,
      );
      sendJson(res, 201, { ok: true, ...result });
      return true;
    }

    if (req.method === "POST" && path === "/api/panel/reseller/activate") {
      const { telegramUser } = await loadAuthedUser(req, { write: true });
      const body = await readJsonBody(req);
      const result = await activatePanelReseller(telegramUser.id, body.username);
      log.event(
        "api",
        `POST /api/panel/reseller/activate tg:${telegramUser.id} user:${result.credentials.username}`,
      );
      sendJson(res, 201, { ok: true, ...result });
      return true;
    }

    if (req.method === "POST" && path === "/api/panel/import/preview") {
      const { telegramUser } = await loadAuthedUser(req);
      const body = await readJsonBody(req);
      const result = await previewExistingPanel(
        telegramUser.id,
        body.username,
        body.password,
        body.kind || body.serviceType,
      );
      log.event(
        "api",
        `POST /api/panel/import/preview tg:${telegramUser.id} user:${result.username}`,
      );
      sendJson(res, 200, { ok: true, ...result });
      return true;
    }

    if (req.method === "POST" && path === "/api/panel/import") {
      const { telegramUser } = await loadAuthedUser(req, { write: true });
      const body = await readJsonBody(req);
      const result = await importExistingPanel(
        telegramUser.id,
        body.username,
        body.password,
        body.kind || body.serviceType,
      );
      log.event(
        "api",
        `POST /api/panel/import tg:${telegramUser.id} user:${result.credentials.username}`,
      );
      sendJson(res, 201, { ok: true, ...result });
      return true;
    }

    const allocateMatch = path.match(/^\/api\/panel\/(\d+)\/allocate$/);
    if (req.method === "POST" && allocateMatch) {
      const { telegramUser } = await loadAuthedUser(req, { write: true });
      const body = await readJsonBody(req);
      const result = await allocatePanelBalance(
        telegramUser.id,
        allocateMatch[1],
        body.amount,
        body.action || body.type || "increase",
      );
      sendJson(res, 200, { ok: true, ...result });
      return true;
    }

    const toggleMatch = path.match(/^\/api\/panel\/(\d+)\/(suspend|reactivate|deactivate)$/);
    if (req.method === "POST" && toggleMatch) {
      const { telegramUser } = await loadAuthedUser(req, { write: true });
      const result = await togglePanelSubscription(
        telegramUser.id,
        toggleMatch[1],
        toggleMatch[2],
      );
      log.event(
        "api",
        `POST /api/panel/${toggleMatch[1]}/${toggleMatch[2]} tg:${telegramUser.id}`,
      );
      sendJson(res, 200, { ok: true, ...result });
      return true;
    }

    const resetPwMatch = path.match(/^\/api\/panel\/(\d+)\/reset-password$/);
    if (req.method === "POST" && resetPwMatch) {
      const { telegramUser } = await loadAuthedUser(req, { write: true });
      const result = await resetPanelPassword(telegramUser.id, resetPwMatch[1]);
      log.event(
        "api",
        `POST /api/panel/${resetPwMatch[1]}/reset-password tg:${telegramUser.id}`,
      );
      sendJson(res, 200, { ok: true, ...result });
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
