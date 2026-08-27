import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { UPLOADS_ROOT } from "../db/cardCharges.js";
import { canAccessReceiptPath } from "../db/receiptUploads.js";
import { loadAuthedUser } from "../lib/auth.js";
import { resolveUnderRoot } from "../lib/security.js";
import { verifyUploadAccess } from "../lib/signedUploads.js";
import { sendUnauthorized, sendJson } from "./respond.js";
import { log } from "../lib/logger.js";

const MIME = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/**
 * Serve /uploads/* via:
 * 1) short-lived HMAC query signature (for <img>), or
 * 2) Telegram Mini App Authorization header
 */
export async function tryServeUpload(req, res, urlPath) {
  if (req.method !== "GET" || !urlPath.startsWith("/uploads/")) return false;

  const url = new URL(req.url || "/", "http://localhost");
  const relative = decodeURIComponent(url.pathname.slice("/uploads/".length));
  if (!relative || relative.includes("\0")) {
    sendUnauthorized(res);
    return true;
  }

  const absolute = resolveUnderRoot(UPLOADS_ROOT, relative);
  if (!absolute || !existsSync(absolute)) {
    sendUnauthorized(res);
    return true;
  }

  let telegramUserId = null;
  let isAdmin = false;

  const sig = url.searchParams.get("sig");
  const exp = url.searchParams.get("exp");
  const uid = url.searchParams.get("uid");

  if (sig && exp && uid) {
    if (!verifyUploadAccess(relative, { uid, exp, sig })) {
      sendUnauthorized(res);
      return true;
    }
    telegramUserId = Number(uid);
    // Signed URLs for admins still need ownership/admin check below;
    // treat as non-admin here — canAccessReceiptPath checks charge ownership too.
    // Admins get signed URLs with their own uid; allow if admin role via DB lookup:
    isAdmin = false;
  } else {
    let authed;
    try {
      authed = await loadAuthedUser(req);
    } catch (error) {
      if (error.status === 429) {
        sendJson(
          res,
          429,
          { ok: false, error: "Too many requests" },
          { "retry-after": String(error.retryAfterSec || 60) },
        );
        return true;
      }
      sendUnauthorized(res);
      return true;
    }
    telegramUserId = authed.telegramUser.id;
    isAdmin = authed.user.canAccessAdminPanel;
  }

  // If signed as uid, also grant admin if that user is admin
  if (!isAdmin && telegramUserId) {
    try {
      const { findUserByTelegramId, toPublicUser } = await import("../db/users.js");
      const row = await findUserByTelegramId(telegramUserId);
      if (row) {
        const pub = toPublicUser(row);
        isAdmin = pub.canAccessAdminPanel;
      }
    } catch {
      // ignore — fall through to ownership check
    }
  }

  const allowed = await canAccessReceiptPath(relative, {
    telegramUserId,
    isAdmin,
  });

  if (!allowed) {
    sendUnauthorized(res);
    return true;
  }

  const ext = path.extname(absolute).toLowerCase();
  const contentType = MIME[ext] || "application/octet-stream";
  const { size } = statSync(absolute);

  log.event("upload", `GET /uploads/${relative} tg:${telegramUserId} size:${size}`);

  res.writeHead(200, {
    "content-type": contentType,
    "content-length": size,
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff",
  });
  createReadStream(absolute).pipe(res);
  return true;
}
