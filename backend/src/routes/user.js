import {
  updateUserProfile,
  toPublicUser,
} from "../db/users.js";
import { loadAuthedUser } from "../lib/auth.js";
import { readJsonBody } from "../http/body.js";
import { sendJson } from "../http/respond.js";
import { log } from "../lib/logger.js";

function sendRouteError(res, error) {
  const status = error.status || 500;
  if (status >= 500) {
    log.error("api", error);
  } else {
    log.warn("api", error.message || "request failed");
  }

  sendJson(res, status, {
    ok: false,
    error: error.message || "Unauthorized",
  });
}

/**
 * User profile routes:
 *   GET   /api/user/me   — current user
 *   PATCH /api/user/me   — update realName / email
 */
export async function handleUserRoutes(req, res, path) {
  if (req.method === "GET" && path === "/api/user/me") {
    try {
      const { user } = await loadAuthedUser(req);
      log.event("api", `GET /api/user/me  @${user.username || user.telegramId}`);
      sendJson(res, 200, { ok: true, user });
      return true;
    } catch (error) {
      sendRouteError(res, error);
      return true;
    }
  }

  if (req.method === "PATCH" && path === "/api/user/me") {
    try {
      const { telegramUser } = await loadAuthedUser(req);
      const body = await readJsonBody(req);
      const patch = {};

      if (Object.prototype.hasOwnProperty.call(body, "realName")) {
        patch.realName = body.realName;
      }
      if (Object.prototype.hasOwnProperty.call(body, "email")) {
        patch.email = body.email;
      }

      const row = await updateUserProfile(telegramUser.id, patch);
      const user = toPublicUser(row);
      log.event("api", `PATCH /api/user/me  @${user.username || user.telegramId}`);
      sendJson(res, 200, { ok: true, user });
      return true;
    } catch (error) {
      sendRouteError(res, error);
      return true;
    }
  }

  return false;
}
