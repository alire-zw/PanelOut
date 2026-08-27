import { loadAuthedUser } from "../lib/auth.js";
import { readJsonBody } from "../http/body.js";
import { sendJson } from "../http/respond.js";
import { log } from "../lib/logger.js";
import {
  createUserTicket,
  getSupportTelegramUsername,
  getSupportTicketsCached,
  getUserTicket,
  replyUserTicket,
  syncSupportTickets,
  syncUserTicket,
} from "../db/supportTickets.js";

const BODY_LIMIT = 1_200_000;

function sendRouteError(res, error) {
  const status = error.status || 500;
  if (status === 401 || status === 403) {
    sendJson(res, status === 403 ? 403 : 401, {
      ok: false,
      error: status === 403 ? error.message || "Forbidden" : "Unauthorized",
    });
    return;
  }
  if (status === 429) {
    sendJson(
      res,
      429,
      { ok: false, error: "Too many requests" },
      { "retry-after": String(error.retryAfterSec || 60) },
    );
    return;
  }
  if (status >= 500) log.error("api", error);
  else log.warn("api", error.message || "request failed");
  sendJson(res, status, { ok: false, error: error.message || "Request failed" });
}

export async function handleSupportRoutes(req, res, path) {
  if (!path.startsWith("/api/support")) return false;

  try {
    if (req.method === "GET" && path === "/api/support/contact") {
      await loadAuthedUser(req);
      const telegramUsername = await getSupportTelegramUsername();
      sendJson(res, 200, {
        ok: true,
        telegramUsername,
        telegramUrl: telegramUsername ? `https://t.me/${telegramUsername}` : null,
      });
      return true;
    }

    if (req.method === "GET" && path === "/api/support/orders") {
      await loadAuthedUser(req);
      // Orders module not wired yet — keep API shape for the support wizard.
      sendJson(res, 200, { ok: true, items: [] });
      return true;
    }

    if (req.method === "GET" && path === "/api/support/tickets") {
      const { user } = await loadAuthedUser(req);
      const payload = await getSupportTicketsCached(user.id);
      sendJson(res, 200, { ok: true, ...payload });
      return true;
    }

    if (req.method === "POST" && path === "/api/support/tickets/sync") {
      const { user } = await loadAuthedUser(req);
      const body = await readJsonBody(req);
      const payload = await syncSupportTickets(user.id, body.version);
      sendJson(res, 200, { ok: true, ...payload });
      return true;
    }

    if (req.method === "POST" && path === "/api/support/tickets") {
      const { user } = await loadAuthedUser(req);
      const body = await readJsonBody(req, { limitBytes: BODY_LIMIT });
      const result = await createUserTicket(user.id, body);
      sendJson(res, 201, { ok: true, ...result });
      return true;
    }

    const ticketMatch = path.match(/^\/api\/support\/tickets\/([^/]+)$/);
    if (req.method === "GET" && ticketMatch) {
      const { user } = await loadAuthedUser(req);
      const idOrCode = decodeURIComponent(ticketMatch[1]);
      const result = await getUserTicket(user.id, idOrCode);
      sendJson(res, 200, { ok: true, ...result });
      return true;
    }

    const syncMatch = path.match(/^\/api\/support\/tickets\/([^/]+)\/sync$/);
    if (req.method === "POST" && syncMatch) {
      const { user } = await loadAuthedUser(req);
      const idOrCode = decodeURIComponent(syncMatch[1]);
      const body = await readJsonBody(req);
      const result = await syncUserTicket(user.id, idOrCode, body.version);
      sendJson(res, 200, { ok: true, ...result });
      return true;
    }

    const replyMatch = path.match(/^\/api\/support\/tickets\/([^/]+)\/messages$/);
    if (req.method === "POST" && replyMatch) {
      const { user } = await loadAuthedUser(req);
      const idOrCode = decodeURIComponent(replyMatch[1]);
      const body = await readJsonBody(req, { limitBytes: BODY_LIMIT });
      const result = await replyUserTicket(user.id, idOrCode, body);
      sendJson(res, 200, { ok: true, ...result });
      return true;
    }

    return false;
  } catch (error) {
    sendRouteError(res, error);
    return true;
  }
}
