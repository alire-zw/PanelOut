import {
  PANEL_TRIAL_ROLE_NAME,
  PANEL_TRIAL_VOLUME_GB,
} from "../constants/service-types.js";
import { generatePanelTrialPassword } from "../lib/panel-trial-password.js";
import { normalizePanelTrialError } from "../lib/panel-trial-error.js";
import { logger } from "../lib/logger.js";
import { PasarGuardClient, getDefaultPasarGuardClientOptions } from "./pasarguard-client.js";
import { buildPanelClientComment } from "./pasarguard-provision.service.js";
import { buildPasarGuardBaseUrl, clearPasarGuardClientCache } from "./pasarguard.service.js";

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

const clientPool = new Map();

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

async function pickPanelTrialRoleId(server) {
  const client = getProvisionClient(server);
  const data = await client.getAdminRolesSimple();
  const roles = data?.roles || [];
  const targetRoleName = PANEL_TRIAL_ROLE_NAME.toLowerCase();

  const picked = roles.find(
    (role) => String(role?.name || "").toLowerCase() === targetRoleName,
  );

  if (!picked?.id) {
    throw new Error("ROLE_NOT_FOUND");
  }

  return Number(picked.id);
}

export async function createPanelTrialAdmin(server, { username, telegramUserId }) {
  const apiUsername = String(username || "").trim().toLowerCase();

  if (await pasarguardAdminExists(server, apiUsername)) {
    throw new Error("USERNAME_TAKEN");
  }

  const password = generatePanelTrialPassword();
  const roleId = await pickPanelTrialRoleId(server);
  const dataLimitBytes = PANEL_TRIAL_VOLUME_GB * 1024 * 1024 * 1024;
  const body = {
    username: apiUsername,
    password,
    role_id: roleId,
    status: "active",
    data_limit: dataLimitBytes,
    note: buildPanelClientComment(telegramUserId),
  };

  let client = getProvisionClient(server);
  let admin;

  try {
    admin = await client.createAdmin(body);
  } catch (err) {
    if (err.status === 401) {
      clearPasarGuardClientCache(server);
      client = getProvisionClient(server, { fresh: true });

      try {
        admin = await client.createAdmin(body);
      } catch (retryErr) {
        const normalized = normalizePanelTrialError(retryErr);
        logger.error("panel-trial", "create admin failed after reauth", {
          serverId: String(server.id),
          serverName: server.serverName,
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
    } else {
      const normalized = normalizePanelTrialError(err);
      logger.error("panel-trial", "create admin failed", {
        serverId: String(server.id),
        serverName: server.serverName,
        username: apiUsername,
        telegramUserId: String(telegramUserId),
        roleId,
        code: normalized.code,
        status: normalized.status,
        error: normalized.message,
      });
      const failure = new Error(normalized.message);
      failure.code = normalized.code;
      failure.status = normalized.status;
      throw failure;
    }
  }

  logger.info("panel-trial", "operator account created", {
    serverId: String(server.id),
    serverName: server.serverName,
    username: admin?.username || apiUsername,
    adminId: admin?.id != null ? String(admin.id) : null,
    role: PANEL_TRIAL_ROLE_NAME,
    telegramUserId: String(telegramUserId),
  });

  const panelUrl = `${buildPasarGuardBaseUrl(server)}/dashboard`;

  return {
    username: admin?.username || apiUsername,
    password,
    panelUrl,
    volumeGb: PANEL_TRIAL_VOLUME_GB,
    adminId: admin?.id ?? null,
  };
}
