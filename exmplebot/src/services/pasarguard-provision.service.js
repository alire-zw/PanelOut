import { logger } from "../lib/logger.js";
import {
  buildOutboundClientEmail,
  buildOutboundSubscriptionPrefix,
  maxOutboundSerialFromNames,
  outboundSubscriptionNameKey,
} from "../lib/outbound-subscription-naming.js";
import {
  buildPasarGuardBaseUrl,
  clearPasarGuardClientCache,
} from "./pasarguard.service.js";
import { PasarGuardClient, getDefaultPasarGuardClientOptions } from "./pasarguard-client.js";
import {
  findSubscriptionByClientEmailAndServer,
  getRecentSubscriptionsByServer,
  isSubscriptionNameTakenOnServer,
  maxSerialFromSubscriptionDb,
} from "./user-subscription.service.js";

function normalizeSubPublicBaseUrl(raw) {
  const value = raw != null ? String(raw).trim() : "";
  if (!value) return null;

  let normalized = value.replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }

  try {
    const url = new URL(normalized.endsWith("/") ? normalized : `${normalized}/`);
    return `${url.origin}${url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "")}/`;
  } catch {
    return null;
  }
}

export function extractSubToken(subscriptionUrl) {
  const match = String(subscriptionUrl || "").match(/\/sub\/([^/?#\s]+)/i);
  return match ? match[1] : null;
}

export function buildFullSubscriptionUrl(server, subscriptionUrl) {
  const raw = String(subscriptionUrl || "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;

  const pub = normalizeSubPublicBaseUrl(server?.subPublicBaseUrl);
  if (pub && raw.startsWith("/sub/")) {
    const token = extractSubToken(raw);
    return token
      ? `${pub.replace(/\/+$/, "")}/${token}`
      : `${pub.replace(/\/+$/, "")}${raw.replace(/^\/sub\/?/, "/")}`;
  }

  const base = buildPasarGuardBaseUrl(server);
  return `${base}${raw.startsWith("/") ? raw : `/${raw}`}`;
}

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

function expireToPasarGuard(expiryTimeMs) {
  const exp = Number(expiryTimeMs) || 0;
  if (exp <= 0) return 0;
  return new Date(exp).toISOString();
}

export async function fetchPasarGuardUser(server, username) {
  const client = getProvisionClient(server);
  return client.getUser(username);
}

export async function getPasarGuardUserUsedTraffic(server, clientEmail) {
  const user = await fetchPasarGuardUser(server, clientEmail);
  return BigInt(user?.used_traffic ?? 0);
}

export async function setPasarGuardUserStatus(server, clientEmail, status) {
  const client = getProvisionClient(server);

  try {
    await client.modifyUser(clientEmail, { status });
  } catch (err) {
    if (err.status === 401) {
      clearPasarGuardClientCache(server);
      const fresh = getProvisionClient(server, { fresh: true });
      await fresh.modifyUser(clientEmail, { status });
    } else {
      throw err;
    }
  }
}

async function pasarguardPanelUserExists(server, username) {
  try {
    await fetchPasarGuardUser(server, username);
    return true;
  } catch (err) {
    if (err.status === 404) return false;
    throw err;
  }
}

async function listPasarGuardUsernames(server) {
  const client = getProvisionClient(server);
  const names = [];
  let offset = 0;
  const limit = 100;

  while (offset < 2000) {
    const data = await client.getUsers({ offset, limit });
    const users = data?.users || [];
    if (!users.length) break;

    for (const row of users) {
      const username = String(row?.username || "").trim();
      if (username) names.push(username);
    }

    offset += users.length;
    if (users.length < limit) break;
  }

  return names;
}

export async function getPasarGuardGroupIds(server) {
  const client = getProvisionClient(server);
  const data = await client.getGroupsSimple({ all: true, limit: 200 });
  const groups = data?.groups || data || [];

  return (Array.isArray(groups) ? groups : [])
    .map((group) => Number(group?.id))
    .filter((id) => Number.isInteger(id) && id > 0);
}

function buildTakenSubscriptionKeys(rows) {
  const set = new Set();

  for (const row of rows || []) {
    for (const raw of [row?.remark, row?.clientEmail]) {
      const key = outboundSubscriptionNameKey(raw);
      if (key) set.add(key);
    }
  }

  return set;
}

function computeNextOutboundSerial(prefix, { recentRows = [], dbNames = [], panelNames = [] } = {}) {
  const recentNames = (recentRows || []).map((row) => row.remark || row.clientEmail);
  const recentMax = maxOutboundSerialFromNames(recentNames, prefix);
  const dbMax = maxOutboundSerialFromNames(dbNames, prefix);
  const panelMax = maxOutboundSerialFromNames(panelNames, prefix);
  return Math.max(recentMax, dbMax, panelMax) + 1;
}

export async function createPasarGuardUser(server, {
  username,
  dataLimitBytes,
  expiryTimeMs = 0,
  groupIds = [],
  note = null,
}) {
  let client = getProvisionClient(server);
  const apiUsername = String(username || "").trim();
  const body = {
    username: apiUsername,
    status: "active",
    data_limit: Math.max(0, Math.floor(Number(dataLimitBytes) || 0)),
    expire: expireToPasarGuard(expiryTimeMs),
    data_limit_reset_strategy: "no_reset",
  };

  const normalizedGroups = groupIds.map(Number).filter(Boolean);
  if (normalizedGroups.length > 0) {
    body.group_ids = normalizedGroups;
  }
  if (note) body.note = note;

  let created;

  try {
    created = await client.createUser(body);
  } catch (err) {
    if (err.status === 401) {
      clearPasarGuardClientCache(server);
      client = getProvisionClient(server, { fresh: true });
      created = await client.createUser(body);
    } else {
      throw err;
    }
  }

  let user = created;
  if (!user?.subscription_url) {
    try {
      user = await client.getUser(apiUsername);
    } catch {
      // Keep created payload if refetch fails.
    }
  }

  const subscriptionUrl = buildFullSubscriptionUrl(server, user?.subscription_url);
  const subId = extractSubToken(user?.subscription_url || subscriptionUrl);

  return {
    success: true,
    clientEmail: apiUsername,
    subscriptionUrl,
    subId,
    groupIds: normalizedGroups,
    user,
  };
}

export function buildPanelClientComment(telegramUserId) {
  return `Created By Panelout | TgUser : ${telegramUserId}`;
}

export async function provisionOutboundVolumeUser(server, { volumeGb, userId, unlimited = false }) {
  const prefix = buildOutboundSubscriptionPrefix(server);
  const dataLimitBytes = unlimited
    ? 0
    : Math.floor(Number(volumeGb) * 1024 * 1024 * 1024);
  const groupIds = await getPasarGuardGroupIds(server);
  const recentRows = await getRecentSubscriptionsByServer(server.id, 10);
  const takenKeys = buildTakenSubscriptionKeys(recentRows);
  const panelNames = await listPasarGuardUsernames(server);
  const dbMax = await maxSerialFromSubscriptionDb(server.id, prefix);
  let baseNext = computeNextOutboundSerial(prefix, {
    recentRows,
    dbNames: [],
    panelNames,
  });
  baseNext = Math.max(baseNext, dbMax + 1);

  let lastError = "Provision failed";

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const clientEmail = buildOutboundClientEmail(server, baseNext + attempt);
    const nameKey = outboundSubscriptionNameKey(clientEmail);

    if (takenKeys.has(nameKey)) {
      lastError = "Subscription name recently taken";
      continue;
    }

    if (await findSubscriptionByClientEmailAndServer(clientEmail, server.id)) {
      lastError = "Username already taken in database";
      continue;
    }

    if (await isSubscriptionNameTakenOnServer(server.id, clientEmail)) {
      lastError = "Username already taken in database";
      continue;
    }

    if (await pasarguardPanelUserExists(server, clientEmail)) {
      lastError = "Username already exists on panel";
      continue;
    }

    try {
      const result = await createPasarGuardUser(server, {
        username: clientEmail,
        dataLimitBytes,
        expiryTimeMs: 0,
        groupIds,
        note: buildPanelClientComment(userId),
      });

      return {
        ...result,
        remark: clientEmail,
        inboundId: groupIds.length ? groupIds.join(",") : null,
      };
    } catch (err) {
      if (err.status === 409 || /exist|duplicate|already/i.test(err.message || "")) {
        lastError = err.message || "Username already exists on panel";
        continue;
      }

      logger.error("pasarguard-provision", "create user failed", {
        serverId: String(server.id),
        clientEmail,
        error: err.message,
      });
      throw err;
    }
  }

  throw new Error(lastError);
}

export async function provisionOutboundUsageUser(server, { userId }) {
  return provisionOutboundVolumeUser(server, {
    volumeGb: 0,
    userId,
    unlimited: true,
  });
}
