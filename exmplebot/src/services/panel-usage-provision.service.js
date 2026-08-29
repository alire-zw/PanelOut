import { PANEL_USAGE_ROLE_NAME } from "../constants/service-types.js";
import { generatePanelTrialPassword } from "../lib/panel-trial-password.js";
import { normalizePanelTrialError } from "../lib/panel-trial-error.js";
import { logger } from "../lib/logger.js";
import { PasarGuardClient, getDefaultPasarGuardClientOptions } from "./pasarguard-client.js";
import { buildPanelClientComment } from "./pasarguard-provision.service.js";
import { buildPasarGuardBaseUrl, clearPasarGuardClientCache } from "./pasarguard.service.js";

const clientPool = new Map();

function getProvisionClient(server, { fresh = false } = {}) {
  const key = `${server.id}:${buildPasarGuardBaseUrl(server)}:${server.userName}`;

  if (!fresh && clientPool.has(key)) {
    return clientPool.get(key);
  }

  const client = new PasarGuardClient(
    getDefaultPasarGuardClientOptions({
      baseUrl: buildPasarGuardBaseUrl(server),
      username: String(server.userName || "").trim(),
      password: String(server.userPassword || ""),
    }),
  );

  clientPool.set(key, client);
  return client;
}

export function buildPanelUsagePermissionOverrides() {
  return {
    max_users: null,
    min_hwid_per_user: 1,
    max_hwid_per_user: null,
  };
}

async function pasarguardAdminExists(server, username) {
  const client = getProvisionClient(server);

  try {
    await client.getAdmin(username);
    return true;
  } catch (err) {
    if (err.status === 404) return false;
    throw err;
  }
}

async function pickPanelUsageRoleId(server) {
  const client = getProvisionClient(server);
  const data = await client.getAdminRolesSimple();
  const roles = data?.roles || [];
  const targetRoleName = PANEL_USAGE_ROLE_NAME.toLowerCase();

  const picked = roles.find(
    (role) => String(role?.name || "").toLowerCase() === targetRoleName,
  );

  if (!picked?.id) {
    throw new Error("ROLE_NOT_FOUND");
  }

  return Number(picked.id);
}

async function requestWithReauth(server, fn) {
  let client = getProvisionClient(server);

  try {
    return await fn(client);
  } catch (err) {
    if (err.status !== 401) {
      throw err;
    }

    clearPasarGuardClientCache(server);
    client = getProvisionClient(server, { fresh: true });
    return fn(client);
  }
}

export async function createPanelUsageAdmin(server, { username, telegramUserId }) {
  const apiUsername = String(username || "").trim().toLowerCase();

  if (await pasarguardAdminExists(server, apiUsername)) {
    throw new Error("USERNAME_TAKEN");
  }

  const password = generatePanelTrialPassword();
  const roleId = await pickPanelUsageRoleId(server);
  const body = {
    username: apiUsername,
    password,
    role_id: roleId,
    status: "active",
    permission_overrides: buildPanelUsagePermissionOverrides(),
    note: buildPanelClientComment(telegramUserId),
  };

  let admin;

  try {
    admin = await requestWithReauth(server, (client) => client.createAdmin(body));
  } catch (err) {
    const normalized = normalizePanelTrialError(err);
    logger.error("panel-usage", "create admin failed", {
      serverId: String(server.id),
      username: apiUsername,
      telegramUserId: String(telegramUserId),
      roleId,
      role: PANEL_USAGE_ROLE_NAME,
      code: normalized.code,
      status: normalized.status,
      error: normalized.message,
    });

    const failure = new Error(normalized.message);
    failure.code = normalized.code;
    failure.status = normalized.status;
    throw failure;
  }

  logger.info("panel-usage", "operator account created", {
    serverId: String(server.id),
    username: admin?.username || apiUsername,
    adminId: admin?.id != null ? String(admin.id) : null,
    roleId,
    telegramUserId: String(telegramUserId),
  });

  return {
    username: admin?.username || apiUsername,
    password,
    panelUrl: `${buildPasarGuardBaseUrl(server)}/dashboard`,
    adminId: admin?.id ?? null,
    roleId,
    usedTraffic: BigInt(admin?.used_traffic ?? 0),
  };
}

function isPanelAdminOwnedByUser(note, telegramUserId) {
  return String(note || "").includes(buildPanelClientComment(telegramUserId));
}

export async function upgradeTrialAdminToPanelUsage(server, { username, telegramUserId }) {
  const apiUsername = String(username || "").trim().toLowerCase();
  let admin;

  try {
    admin = await fetchPanelUsageAdmin(server, apiUsername);
  } catch (err) {
    if (err.status === 404) {
      const failure = new Error("TRIAL_ADMIN_NOT_FOUND");
      failure.code = "TRIAL_ADMIN_NOT_FOUND";
      throw failure;
    }

    throw err;
  }

  if (!isPanelAdminOwnedByUser(admin?.note, telegramUserId)) {
    const failure = new Error("USERNAME_TAKEN");
    failure.code = "USERNAME_TAKEN";
    throw failure;
  }

  const roleId = await pickPanelUsageRoleId(server);

  try {
    admin = await requestWithReauth(server, (client) =>
      client.modifyAdmin(apiUsername, {
        role_id: roleId,
        status: "active",
        data_limit: 0,
        permission_overrides: buildPanelUsagePermissionOverrides(),
      }),
    );
  } catch (err) {
    const normalized = normalizePanelTrialError(err);
    logger.error("panel-usage", "upgrade trial admin failed", {
      serverId: String(server.id),
      username: apiUsername,
      telegramUserId: String(telegramUserId),
      code: normalized.code,
      status: normalized.status,
      error: normalized.message,
    });

    const failure = new Error(normalized.message);
    failure.code = normalized.code;
    failure.status = normalized.status;
    throw failure;
  }

  logger.info("panel-usage", "trial admin upgraded to usage", {
    serverId: String(server.id),
    username: admin?.username || apiUsername,
    adminId: admin?.id != null ? String(admin.id) : null,
    telegramUserId: String(telegramUserId),
  });

  return {
    username: admin?.username || apiUsername,
    panelUrl: `${buildPasarGuardBaseUrl(server)}/dashboard`,
    adminId: admin?.id ?? null,
    roleId,
    usedTraffic: BigInt(admin?.used_traffic ?? 0),
    upgradedFromTrial: true,
  };
}

export async function fetchPanelUsageAdmin(server, username) {
  return requestWithReauth(server, (client) => client.getAdmin(username));
}

export async function getPanelUsageAdminUsedTraffic(server, username) {
  const admin = await fetchPanelUsageAdmin(server, username);
  return BigInt(admin?.used_traffic ?? 0);
}

export async function disableAllPanelAdminActiveUsers(server, username) {
  return requestWithReauth(server, (client) =>
    client.disableAllAdminActiveUsers(username),
  );
}

export async function activateAllPanelAdminDisabledUsers(server, username) {
  return requestWithReauth(server, (client) =>
    client.activateAllAdminDisabledUsers(username),
  );
}

export async function setPanelAdminStatus(server, username, status) {
  const apiUsername = String(username || "").trim().toLowerCase();

  return requestWithReauth(server, (client) =>
    client.modifyAdmin(apiUsername, { status }),
  );
}
