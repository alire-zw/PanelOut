import { PasarGuardClient } from "./pasarguardClient.js";
import { buildBaseUrl, clearPasarGuardClientCache } from "./pasarguardService.js";
import { generatePanelAdminPassword } from "./panelPassword.js";
import { log } from "./logger.js";

export const PANEL_TRIAL_VOLUME_GB = 5;
export const PANEL_USAGE_MIN_BALANCE_GB = 50;
export const PANEL_USAGE_PRICE_PER_GB = 4000;
export const PANEL_ROLE_NAME = "operator";

const clientPool = new Map();

function panelClientKey(panel) {
  return `${panel.id}:${buildBaseUrl(panel)}:${panel.adminUsername}`;
}

export function getProvisionClient(panel, { fresh = false } = {}) {
  const key = panelClientKey(panel);
  if (!fresh && clientPool.has(key)) {
    return clientPool.get(key);
  }
  const client = new PasarGuardClient({
    baseUrl: buildBaseUrl(panel),
    username: String(panel.adminUsername || "").trim(),
    password: String(panel.adminPassword || ""),
  });
  clientPool.set(key, client);
  return client;
}

export function buildPanelClientComment(telegramUserId) {
  return `Created By Panelout | TgUser : ${telegramUserId}`;
}

async function requestWithReauth(panel, fn) {
  let client = getProvisionClient(panel);
  try {
    return await fn(client);
  } catch (err) {
    if (err.status !== 401) throw err;
    clearPasarGuardClientCache(panel);
    clientPool.delete(panelClientKey(panel));
    client = getProvisionClient(panel, { fresh: true });
    return fn(client);
  }
}

async function adminExists(panel, username) {
  try {
    await requestWithReauth(panel, (client) => client.getAdmin(username));
    return true;
  } catch (err) {
    if (err.status === 404) return false;
    throw err;
  }
}

async function pickRoleId(panel, roleName = PANEL_ROLE_NAME) {
  const data = await requestWithReauth(panel, (client) => client.getAdminRolesSimple());
  const roles = data?.roles || [];
  const target = String(roleName).toLowerCase();
  const picked = roles.find((role) => String(role?.name || "").toLowerCase() === target);
  if (!picked?.id) {
    const err = new Error("ROLE_NOT_FOUND");
    err.code = "ROLE_NOT_FOUND";
    err.status = 409;
    throw err;
  }
  return Number(picked.id);
}

function buildPanelDashboardUrl(panel) {
  return `${buildBaseUrl(panel)}/dashboard`;
}

function buildNoHwidPermissionOverrides() {
  return {
    min_hwid_per_user: null,
    max_hwid_per_user: null,
  };
}

function buildUsagePermissionOverrides() {
  return {
    max_users: null,
    ...buildNoHwidPermissionOverrides(),
  };
}

function mergePermissionOverrides(existingOverrides, patch) {
  return {
    ...(existingOverrides && typeof existingOverrides === "object" ? existingOverrides : {}),
    ...patch,
  };
}

export function adminHasHwidLimits(admin) {
  const overrides = admin?.permission_overrides;
  if (!overrides || typeof overrides !== "object") return false;
  return overrides.min_hwid_per_user != null || overrides.max_hwid_per_user != null;
}

export function needsPanelAdminHwidPatch(admin) {
  if (admin?.permission_overrides == null) return true;
  return adminHasHwidLimits(admin);
}

export async function clearPanelAdminHwidLimits(panel, username) {
  const apiUsername = String(username || "").trim();
  let admin;

  try {
    admin = await requestWithReauth(panel, (client) => client.getAdmin(apiUsername));
  } catch (err) {
    if (err.status === 404) {
      return { updated: false, reason: "not_found", username: apiUsername };
    }
    throw err;
  }

  if (!needsPanelAdminHwidPatch(admin)) {
    return { updated: false, reason: "already_clear", username: apiUsername };
  }

  const permission_overrides = mergePermissionOverrides(
    admin.permission_overrides,
    buildNoHwidPermissionOverrides(),
  );

  await requestWithReauth(panel, (client) =>
    client.modifyAdmin(apiUsername, { permission_overrides }),
  );

  log.event("panel", `hwid limits cleared user:${apiUsername} panel:${panel.id}`);
  return { updated: true, username: apiUsername };
}

function mapProvisionError(err) {
  const message = err.message || String(err);
  if (err.code === "USERNAME_TAKEN" || message.includes("USERNAME_TAKEN")) {
    return Object.assign(new Error("این نام کاربری قبلاً استفاده شده است"), {
      status: 409,
      code: "USERNAME_TAKEN",
    });
  }
  if (err.code === "ROLE_NOT_FOUND") {
    return Object.assign(new Error("نقش operator در پنل یافت نشد"), {
      status: 409,
      code: "ROLE_NOT_FOUND",
    });
  }
  if (err.status === 401) {
    return Object.assign(new Error("اتصال به پنل ناموفق بود"), {
      status: 502,
      code: "PANEL_AUTH_FAILED",
    });
  }
  return Object.assign(new Error(message || "خطا در ساخت پنل"), {
    status: err.status && err.status >= 400 && err.status < 600 ? err.status : 500,
    code: err.code || "PROVISION_FAILED",
  });
}

export async function createPanelTrialAdmin(panel, { username, telegramUserId }) {
  const apiUsername = String(username || "").trim();

  if (await adminExists(panel, apiUsername)) {
    throw mapProvisionError(new Error("USERNAME_TAKEN"));
  }

  const password = generatePanelAdminPassword();
  const roleId = await pickRoleId(panel);
  const dataLimitBytes = PANEL_TRIAL_VOLUME_GB * 1024 * 1024 * 1024;
  const body = {
    username: apiUsername,
    password,
    role_id: roleId,
    status: "active",
    data_limit: dataLimitBytes,
    permission_overrides: buildNoHwidPermissionOverrides(),
    note: buildPanelClientComment(telegramUserId),
  };

  let admin;
  try {
    admin = await requestWithReauth(panel, (client) => client.createAdmin(body));
  } catch (err) {
    log.error("panel-provision", `trial create failed — ${err.message}`);
    throw mapProvisionError(err);
  }

  log.event("panel", `trial created user:${apiUsername} tg:${telegramUserId}`);

  return {
    username: admin?.username || apiUsername,
    password,
    panelUrl: buildPanelDashboardUrl(panel),
    adminId: admin?.id ?? null,
    volumeGb: PANEL_TRIAL_VOLUME_GB,
    usedTraffic: BigInt(admin?.used_traffic ?? 0),
  };
}

export async function createPanelUsageAdmin(panel, { username, telegramUserId }) {
  const apiUsername = String(username || "").trim();

  if (await adminExists(panel, apiUsername)) {
    throw mapProvisionError(new Error("USERNAME_TAKEN"));
  }

  const password = generatePanelAdminPassword();
  const roleId = await pickRoleId(panel);
  const body = {
    username: apiUsername,
    password,
    role_id: roleId,
    status: "active",
    permission_overrides: buildUsagePermissionOverrides(),
    note: buildPanelClientComment(telegramUserId),
  };

  let admin;
  try {
    admin = await requestWithReauth(panel, (client) => client.createAdmin(body));
  } catch (err) {
    log.error("panel-provision", `usage create failed — ${err.message}`);
    throw mapProvisionError(err);
  }

  log.event("panel", `usage created user:${apiUsername} tg:${telegramUserId}`);

  return {
    username: admin?.username || apiUsername,
    password,
    panelUrl: buildPanelDashboardUrl(panel),
    adminId: admin?.id ?? null,
    usedTraffic: BigInt(admin?.used_traffic ?? 0),
  };
}

export async function upgradeTrialAdminToPanelUsage(panel, { username, telegramUserId }) {
  const apiUsername = String(username || "").trim();
  let admin;

  try {
    admin = await requestWithReauth(panel, (client) => client.getAdmin(apiUsername));
  } catch (err) {
    if (err.status === 404) {
      throw Object.assign(new Error("اکانت تست یافت نشد"), {
        status: 404,
        code: "TRIAL_ADMIN_NOT_FOUND",
      });
    }
    throw mapProvisionError(err);
  }

  if (!String(admin?.note || "").includes(buildPanelClientComment(telegramUserId))) {
    throw mapProvisionError(new Error("USERNAME_TAKEN"));
  }

  const roleId = await pickRoleId(panel);

  try {
    admin = await requestWithReauth(panel, (client) =>
      client.modifyAdmin(apiUsername, {
        role_id: roleId,
        status: "active",
        data_limit: 0,
        permission_overrides: buildUsagePermissionOverrides(),
      }),
    );
  } catch (err) {
    log.error("panel-provision", `usage upgrade failed — ${err.message}`);
    throw mapProvisionError(err);
  }

  log.event("panel", `usage upgraded from trial user:${apiUsername} tg:${telegramUserId}`);

  return {
    username: admin?.username || apiUsername,
    password: null,
    panelUrl: buildPanelDashboardUrl(panel),
    adminId: admin?.id ?? null,
    upgradedFromTrial: true,
    usedTraffic: BigInt(admin?.used_traffic ?? 0),
  };
}

export async function getPanelAdminUsedTraffic(panel, username) {
  const admin = await requestWithReauth(panel, (client) =>
    client.getAdmin(String(username || "").trim()),
  );
  return BigInt(admin?.used_traffic ?? 0);
}

export async function getPanelAdminLiveStats(panel, username) {
  const admin = await requestWithReauth(panel, (client) =>
    client.getAdmin(String(username || "").trim()),
  );

  const usedTraffic = BigInt(admin?.used_traffic ?? 0);
  const lifetimeUsedTraffic = BigInt(
    admin?.lifetime_used_traffic ?? admin?.used_traffic ?? 0,
  );
  const totalUsers = Number(
    admin?.total_users ?? admin?.users_count ?? admin?.users?.length ?? 0,
  );
  const maxUsers =
    admin?.max_users != null && admin.max_users !== ""
      ? Number(admin.max_users)
      : admin?.permission_overrides?.max_users != null
        ? Number(admin.permission_overrides.max_users)
        : null;

  return {
    usedTraffic,
    lifetimeUsedTraffic,
    totalUsers: Number.isFinite(totalUsers) ? totalUsers : 0,
    maxUsers: Number.isFinite(maxUsers) ? maxUsers : null,
    isDisabled: Boolean(admin?.is_disabled),
    enabled: admin?.enabled !== false && !admin?.is_disabled,
  };
}

export async function disableAllPanelAdminActiveUsers(panel, username) {
  return requestWithReauth(panel, (client) =>
    client.disableAllAdminActiveUsers(String(username || "").trim()),
  );
}

export async function activateAllPanelAdminDisabledUsers(panel, username) {
  return requestWithReauth(panel, (client) =>
    client.activateAllAdminDisabledUsers(String(username || "").trim()),
  );
}

export async function verifyPanelAdminPassword(panel, username, password) {
  const client = new PasarGuardClient({
    baseUrl: buildBaseUrl(panel),
    username: String(username || "").trim(),
    password: String(password || ""),
    timeoutMs: 8000,
    maxRetries: 1,
  });
  try {
    await client.authenticateOnce();
    return true;
  } catch (err) {
    if (err.status === 401 || err.status === 403) return false;
    throw err;
  }
}

function parseAdminDataLimitBytes(admin) {
  const raw =
    admin?.data_limit ??
    admin?.dataLimit ??
    admin?.data_limit_bytes ??
    admin?.traffic_limit ??
    admin?.trafficLimit ??
    0;
  try {
    const value = BigInt(raw || 0);
    if (value <= 0n) return 0n;
    const GB = 1024n ** 3n;
    if (value < GB) return value * GB;
    return value;
  } catch {
    return 0n;
  }
}

export async function lookupLegacyPanelAdmin(panel, { username, password }) {
  const apiUsername = String(username || "").trim();
  let admin;

  try {
    admin = await requestWithReauth(panel, (client) => client.getAdmin(apiUsername));
  } catch (err) {
    if (err.status === 404) return null;
    throw mapProvisionError(err);
  }

  const passwordOk = await verifyPanelAdminPassword(panel, apiUsername, password);
  if (!passwordOk) {
    const err = new Error("نام کاربری یا رمز عبور نادرست است");
    err.status = 401;
    err.code = "INVALID_CREDENTIALS";
    throw err;
  }

  return {
    username: admin?.username || apiUsername,
    password,
    panelUrl: buildPanelDashboardUrl(panel),
    adminId: admin?.id ?? admin?.admin_id ?? null,
    usedTraffic: BigInt(admin?.used_traffic ?? 0),
    dataLimitBytes: parseAdminDataLimitBytes(admin),
  };
}

export async function convertLegacyPanelToUnlimited(panel, { username, telegramUserId }) {
  const apiUsername = String(username || "").trim();
  const roleId = await pickRoleId(panel);

  try {
    const admin = await requestWithReauth(panel, (client) =>
      client.modifyAdmin(apiUsername, {
        role_id: roleId,
        status: "active",
        data_limit: 0,
        permission_overrides: buildUsagePermissionOverrides(),
        note: buildPanelClientComment(telegramUserId),
      }),
    );
    log.event("panel", `legacy claimed user:${apiUsername} tg:${telegramUserId} panel:${panel.id}`);
    return admin;
  } catch (err) {
    log.error("panel-provision", `legacy claim modify failed — ${err.message}`);
    throw mapProvisionError(err);
  }
}

export async function claimLegacyPanelAdmin(panel, { username, password, telegramUserId }) {
  const found = await lookupLegacyPanelAdmin(panel, { username, password });
  if (!found) return null;
  await convertLegacyPanelToUnlimited(panel, { username: found.username, telegramUserId });
  return found;
}

export async function updatePanelAdminPassword(panel, username, newPassword) {
  return requestWithReauth(panel, (client) =>
    client.modifyAdmin(String(username || "").trim(), {
      password: String(newPassword || ""),
    }),
  );
}

export function getPanelUsageMinimumBalanceIrt(pricePerGb = PANEL_USAGE_PRICE_PER_GB) {
  return PANEL_USAGE_MIN_BALANCE_GB * (Number(pricePerGb) || PANEL_USAGE_PRICE_PER_GB);
}
