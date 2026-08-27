import { loadAuthedUser } from "../lib/auth.js";
import { sendJson } from "../http/respond.js";
import { log } from "../lib/logger.js";
import {
  checkChannelLockMembership,
  getChannelLockStatus,
  isChannelLockSlot,
} from "../db/systemChannels.js";

function sendRouteError(res, error) {
  const status = error.status || 500;
  if (status === 401 || status === 403) {
    sendJson(res, status === 403 ? 403 : 401, {
      ok: false,
      error: status === 403 ? error.message || "Forbidden" : "Unauthorized",
    });
    return;
  }
  if (status >= 500) log.error("api", error);
  else log.warn("api", error.message || "request failed");
  sendJson(res, status, { ok: false, error: error.message || "Request failed" });
}

export async function handleChannelLockRoutes(req, res, path) {
  if (!path.startsWith("/api/channel-lock")) return false;

  try {
    if (req.method === "GET" && path === "/api/channel-lock/status") {
      const { user } = await loadAuthedUser(req);
      const status = await getChannelLockStatus(user);
      sendJson(res, 200, { ok: true, ...status });
      return true;
    }

    const checkMatch = path.match(/^\/api\/channel-lock\/check\/([^/]+)$/);
    if (req.method === "GET" && checkMatch) {
      const { user } = await loadAuthedUser(req);
      const slotKey = decodeURIComponent(checkMatch[1]);
      if (!isChannelLockSlot(slotKey)) {
        sendJson(res, 404, { ok: false, error: "کانال پیدا نشد یا غیرفعال است" });
        return true;
      }
      const channel = await checkChannelLockMembership(user, slotKey);
      if (!channel) {
        sendJson(res, 404, { ok: false, error: "کانال پیدا نشد یا غیرفعال است" });
        return true;
      }
      sendJson(res, 200, { ok: true, channel });
      return true;
    }

    return false;
  } catch (error) {
    sendRouteError(res, error);
    return true;
  }
}
