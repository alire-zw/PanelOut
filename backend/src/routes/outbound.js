import { loadAuthedUser } from "../lib/auth.js";
import { readJsonBody } from "../http/body.js";
import { sendJson } from "../http/respond.js";
import { log } from "../lib/logger.js";
import {
  activateOutboundUsage,
  deactivateOutboundUsage,
  getOutboundOptions,
  getMyOutbound,
  OutboundServiceError,
  purchaseOutboundVolume,
  toggleOutboundVolume,
} from "../services/outboundPurchase.service.js";
import { getOutboundVolumeQuote } from "../lib/outboundVolumePricing.js";
import { getPricingSettings } from "../db/pricingSettings.js";
import { clampOutboundVolumeGb } from "../lib/outboundVolumeSteps.js";

function sendRouteError(res, error) {
  const status = error.status || 500;
  if (status >= 500) log.error("api", error.stack || error.message || error);
  else log.warn("api", error.message || "request failed");

  const payload = { ok: false, error: error.message || "Request failed" };
  if (error.code) payload.code = error.code;
  sendJson(res, status, payload);
}

export async function handleOutboundRoutes(req, res, path) {
  if (!path.startsWith("/api/outbound")) return false;

  try {
    if (req.method === "GET" && path === "/api/outbound/options") {
      const { telegramUser } = await loadAuthedUser(req);
      const options = await getOutboundOptions(telegramUser.id);
      sendJson(res, 200, { ok: true, ...options });
      return true;
    }

    if (req.method === "GET" && path.startsWith("/api/outbound/quote")) {
      const { telegramUser } = await loadAuthedUser(req);
      void telegramUser;
      const url = new URL(req.url, "http://localhost");
      const volumeGb = clampOutboundVolumeGb(url.searchParams.get("volumeGb"));
      const pricing = await getPricingSettings();
      const quote = getOutboundVolumeQuote(volumeGb, pricing.outboundPricePerGb);
      sendJson(res, 200, { ok: true, quote });
      return true;
    }

    if (req.method === "GET" && path === "/api/outbound/mine") {
      const { telegramUser } = await loadAuthedUser(req);
      const payload = await getMyOutbound(telegramUser.id);
      sendJson(res, 200, { ok: true, ...payload });
      return true;
    }

    if (req.method === "GET" && path === "/api/outbound/mine/sync") {
      const { telegramUser } = await loadAuthedUser(req);
      const url = new URL(req.url, "http://localhost");
      const version = url.searchParams.get("version") || "";
      const { syncMyPanels } = await import("../db/userPanelsCache.js");
      const result = await syncMyPanels(telegramUser.id, version);
      const outbound = result.panels.filter(
        (p) =>
          p.serviceType === "outbound_volume" || p.serviceType === "outbound_usage",
      );
      sendJson(res, 200, {
        ok: true,
        changed: result.changed,
        version: result.version,
        cachedAt: result.cachedAt,
        subscriptions: outbound,
        userBalance: result.userBalance,
      });
      return true;
    }

    if (req.method === "POST" && path === "/api/outbound/volume/purchase") {
      const { telegramUser } = await loadAuthedUser(req, { write: true });
      const body = await readJsonBody(req);
      const result = await purchaseOutboundVolume(telegramUser.id, body.volumeGb);
      log.event(
        "api",
        `POST /api/outbound/volume/purchase tg:${telegramUser.id} gb:${body.volumeGb}`,
      );
      sendJson(res, 201, { ok: true, ...result });
      return true;
    }

    if (req.method === "POST" && path === "/api/outbound/usage/activate") {
      const { telegramUser } = await loadAuthedUser(req, { write: true });
      const result = await activateOutboundUsage(telegramUser.id);
      log.event("api", `POST /api/outbound/usage/activate tg:${telegramUser.id}`);
      sendJson(res, 201, { ok: true, ...result });
      return true;
    }

    const deactivateMatch = path.match(/^\/api\/outbound\/usage\/(\d+)\/deactivate$/);
    if (req.method === "POST" && deactivateMatch) {
      const { telegramUser } = await loadAuthedUser(req, { write: true });
      const result = await deactivateOutboundUsage(telegramUser.id, deactivateMatch[1]);
      log.event(
        "api",
        `POST /api/outbound/usage/${deactivateMatch[1]}/deactivate tg:${telegramUser.id}`,
      );
      sendJson(res, 200, { ok: true, ...result });
      return true;
    }

    const toggleMatch = path.match(/^\/api\/outbound\/(\d+)\/toggle$/);
    if (req.method === "POST" && toggleMatch) {
      const { telegramUser } = await loadAuthedUser(req, { write: true });
      const result = await toggleOutboundVolume(telegramUser.id, toggleMatch[1]);
      log.event(
        "api",
        `POST /api/outbound/${toggleMatch[1]}/toggle tg:${telegramUser.id}`,
      );
      sendJson(res, 200, { ok: true, ...result });
      return true;
    }

    return false;
  } catch (error) {
    if (error instanceof OutboundServiceError || error.name === "OutboundServiceError") {
      sendRouteError(res, error);
      return true;
    }
    sendRouteError(res, error);
    return true;
  }
}
