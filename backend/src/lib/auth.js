import { config } from "../config.js";
import {
  extractInitData,
  validateTelegramInitData,
} from "./telegramAuth.js";
import {
  upsertUserFromTelegram,
  toPublicUser,
  isStaffRole,
  isSupervisorRole,
} from "../db/users.js";
import { assertTrustedMiniAppOrigin } from "./security.js";
import {
  assertNotAuthLocked,
  enforceRateLimit,
  enforceUserRateLimit,
  registerAuthFailure,
} from "./rateLimit.js";

function isWriteMethod(method) {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(String(method || "").toUpperCase());
}

function maxAgeFor(req, { admin = false } = {}) {
  if (admin) return config.authMaxAgeAdminSec;
  if (isWriteMethod(req.method)) return config.authMaxAgeWriteSec;
  return config.authMaxAgeReadSec;
}

async function gateTelegramRequest(req, { admin = false } = {}) {
  await assertNotAuthLocked(req);
  await enforceRateLimit(req, admin ? "api-admin" : "api", {
    limit: admin ? 120 : 240,
    windowSec: 60,
  });

  assertTrustedMiniAppOrigin(req, config.corsOrigins);

  try {
    const initData = extractInitData(req);
    const validated = validateTelegramInitData(initData, config.botToken, {
      maxAgeSeconds: maxAgeFor(req, { admin }),
    });
    return validated;
  } catch (error) {
    await registerAuthFailure(req);
    // Stealth: never leak validation details to clients
    throw Object.assign(new Error("Unauthorized"), {
      status: 401,
      cause: error,
    });
  }
}

export async function requireTelegramUser(req, options = {}) {
  const validated = await gateTelegramRequest(req, options);
  return validated.user;
}

export async function loadAuthedUser(req, options = {}) {
  const telegramUser = await requireTelegramUser(req, options);
  await enforceUserRateLimit(telegramUser.id, options.admin ? "user-admin" : "user", {
    limit: options.admin ? 90 : 180,
    windowSec: 60,
  });

  const row = await upsertUserFromTelegram(telegramUser);
  const user = toPublicUser(row);

  if (user.isBanned) {
    throw Object.assign(new Error("Unauthorized"), { status: 403 });
  }

  return { telegramUser, row, user };
}

/**
 * Admin panel access.
 * Hierarchy: Supervisor > Admin > User
 *
 * @param {{ write?: boolean, supervisorOnly?: boolean }} [options]
 *   write=true → Admin یا Supervisor
 *   supervisorOnly=true → فقط Supervisor
 */
export async function loadAdminUser(req, options = {}) {
  const authed = await loadAuthedUser(req, { ...options, admin: true });

  if (!authed.user.canAccessAdminPanel) {
    throw Object.assign(new Error("Unauthorized"), { status: 403 });
  }

  if (options.supervisorOnly && !isSupervisorRole(authed.user.role)) {
    throw Object.assign(new Error("فقط سوپروایزر مجاز به این عملیات است"), {
      status: 403,
    });
  }

  if (options.write && !isStaffRole(authed.user.role)) {
    throw Object.assign(new Error("دسترسی کافی برای این عملیات وجود ندارد"), {
      status: 403,
    });
  }

  await enforceUserRateLimit(authed.telegramUser.id, "admin-action", {
    limit: options.write || options.supervisorOnly ? 30 : 60,
    windowSec: 60,
  });

  return authed;
}
