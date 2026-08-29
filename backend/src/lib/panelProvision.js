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

function getProvisionClient(panel, { fresh = false } = {}) {
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

function buildUsagePermissionOverrides() {
  return {
    max_users: null,
    min_hwid_per_user: 1,
    max_hwid_per_user: null,
  };
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
  const apiUsername = String(username || "").trim().toLowerCase();

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
  };
}

export async function createPanelUsageAdmin(panel, { username, telegramUserId }) {
  const apiUsername = String(username || "").trim().toLowerCase();

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
  };
}

export async function upgradeTrialAdminToPanelUsage(panel, { username, telegramUserId }) {
  const apiUsername = String(username || "").trim().toLowerCase();
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
  };
}

export function getPanelUsageMinimumBalanceIrt() {
  return PANEL_USAGE_MIN_BALANCE_GB * PANEL_USAGE_PRICE_PER_GB;
}
