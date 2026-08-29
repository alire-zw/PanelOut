import { PANEL_UNLIMITED_ROLE_NAME } from "../constants/service-types.js";
import { generatePanelTrialPassword } from "../lib/panel-trial-password.js";
import { normalizePanelTrialError } from "../lib/panel-trial-error.js";
import { logger } from "../lib/logger.js";
import { PasarGuardClient, getDefaultPasarGuardClientOptions } from "./pasarguard-client.js";
import { buildPanelClientComment } from "./pasarguard-provision.service.js";
import { buildPasarGuardBaseUrl, clearPasarGuardClientCache } from "./pasarguard.service.js";

const clientPool = new Map();
const SECONDS_PER_DAY = 24 * 60 * 60;

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

function panelUnlimitedExpireMaxSeconds(days) {
  return (Number(days) + 1) * SECONDS_PER_DAY;
}

export function buildPanelUnlimitedPermissionOverrides({
  subscriptionCount,
  maxUsersPerSub,
  days,
}) {
  return {
    max_users: Number(subscriptionCount),
    expire_max: panelUnlimitedExpireMaxSeconds(days),
    min_hwid_per_user: 1,
    max_hwid_per_user: Number(maxUsersPerSub),
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

async function pickPanelUnlimitedRoleId(server) {
  const client = getProvisionClient(server);
  const data = await client.getAdminRolesSimple();
  const roles = data?.roles || [];
  const targetRoleName = PANEL_UNLIMITED_ROLE_NAME.toLowerCase();

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

export async function createPanelUnlimitedAdmin(
  server,
  { username, telegramUserId, subscriptionCount, maxUsersPerSub, days },
) {
  const apiUsername = String(username || "").trim().toLowerCase();

  if (await pasarguardAdminExists(server, apiUsername)) {
    throw new Error("USERNAME_TAKEN");
  }

  const password = generatePanelTrialPassword();
  const roleId = await pickPanelUnlimitedRoleId(server);
  const permissionOverrides = buildPanelUnlimitedPermissionOverrides({
    subscriptionCount,
    maxUsersPerSub,
    days,
  });

  const body = {
    username: apiUsername,
    password,
    role_id: roleId,
    status: "active",
    permission_overrides: permissionOverrides,
    note: buildPanelClientComment(telegramUserId),
  };

  let admin;

  try {
    admin = await requestWithReauth(server, (client) => client.createAdmin(body));
  } catch (err) {
    const normalized = normalizePanelTrialError(err);
    logger.error("panel-unlimited", "create admin failed", {
      serverId: String(server.id),
      username: apiUsername,
      telegramUserId: String(telegramUserId),
      roleId,
      role: PANEL_UNLIMITED_ROLE_NAME,
      permissionOverrides,
      code: normalized.code,
      status: normalized.status,
      error: normalized.message,
    });

    const failure = new Error(normalized.message);
    failure.code = normalized.code;
    failure.status = normalized.status;
    throw failure;
  }

  logger.info("panel-unlimited", "operator account created", {
    serverId: String(server.id),
    username: admin?.username || apiUsername,
    adminId: admin?.id != null ? String(admin.id) : null,
    roleId,
    role: PANEL_UNLIMITED_ROLE_NAME,
    permissionOverrides,
    telegramUserId: String(telegramUserId),
  });

  return {
    username: admin?.username || apiUsername,
    password,
    panelUrl: `${buildPasarGuardBaseUrl(server)}/dashboard`,
    adminId: admin?.id ?? null,
    roleId,
    subscriptionCount,
    maxUsersPerSub,
    days,
  };
}

export async function upgradePanelUnlimitedAdmin(
  server,
  {
    username,
    additionalSubscriptionCount,
    maxUsersPerSub,
    days,
  },
) {
  const apiUsername = String(username || "").trim().toLowerCase();
  const admin = await requestWithReauth(server, (client) => client.getAdmin(apiUsername));
  const currentOverrides = admin?.permission_overrides || {};
  const nextMaxUsers =
    (Number(currentOverrides.max_users) || 0) + Number(additionalSubscriptionCount);

  const permissionOverrides = {
    max_users: nextMaxUsers,
    expire_max: panelUnlimitedExpireMaxSeconds(days),
    min_hwid_per_user: 1,
    max_hwid_per_user: Math.max(
      Number(currentOverrides.max_hwid_per_user) || 1,
      Number(maxUsersPerSub) || 1,
    ),
  };

  const updated = await requestWithReauth(server, (client) =>
    client.modifyAdmin(apiUsername, {
      permission_overrides: permissionOverrides,
    }),
  );

  logger.info("panel-unlimited", "operator limits upgraded", {
    serverId: String(server.id),
    username: apiUsername,
    permissionOverrides: JSON.stringify(permissionOverrides),
  });

  return {
    username: apiUsername,
    adminId: updated?.id ?? admin?.id ?? null,
    roleId: admin?.role?.id ?? null,
    subscriptionCount: nextMaxUsers,
    maxUsersPerSub: permissionOverrides.max_hwid_per_user,
    days,
  };
}
