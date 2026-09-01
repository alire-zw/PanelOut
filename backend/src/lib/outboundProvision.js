import { log } from "./logger.js";
import {
  buildOutboundClientEmail,
  buildOutboundSubscriptionPrefix,
  maxOutboundSerialFromNames,
  outboundSubscriptionNameKey,
} from "./outboundSubscriptionNaming.js";
import { getProvisionClient, buildPanelClientComment } from "./panelProvision.js";
import { buildBaseUrl, clearPasarGuardClientCache } from "./pasarguardService.js";
import {
  findSubscriptionByClientEmailAndPanel,
  getRecentOutboundSubscriptionsByPanel,
  maxOutboundSerialFromDb,
} from "../db/userPanelSubscriptions.js";

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

export function buildFullSubscriptionUrl(panel, subscriptionUrl) {
  const raw = String(subscriptionUrl || "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;

  const pub = normalizeSubPublicBaseUrl(panel?.subPublicBaseUrl);
  if (pub && raw.startsWith("/sub/")) {
    const token = extractSubToken(raw);
    return token
      ? `${pub.replace(/\/+$/, "")}/${token}`
      : `${pub.replace(/\/+$/, "")}${raw.replace(/^\/sub\/?/, "/")}`;
  }

  const base = buildBaseUrl(panel);
  return `${base}${raw.startsWith("/") ? raw : `/${raw}`}`;
}

async function requestWithReauth(panel, fn) {
  let client = getProvisionClient(panel);
  try {
    return await fn(client);
  } catch (err) {
    if (err.status !== 401) throw err;
    clearPasarGuardClientCache(panel);
    client = getProvisionClient(panel, { fresh: true });
    return fn(client);
  }
}

export async function fetchOutboundUser(panel, username) {
  return requestWithReauth(panel, (client) => client.getUser(username));
}

export async function getOutboundUserUsedTraffic(panel, clientEmail) {
  const user = await fetchOutboundUser(panel, clientEmail);
  return BigInt(user?.used_traffic ?? 0);
}

export async function setOutboundUserStatus(panel, clientEmail, status) {
  await requestWithReauth(panel, (client) =>
    client.modifyUser(clientEmail, { status }),
  );
}

async function pasarguardUserExists(panel, username) {
  try {
    await fetchOutboundUser(panel, username);
    return true;
  } catch (err) {
    if (err.status === 404) return false;
    throw err;
  }
}

async function listPasarGuardUsernames(panel) {
  const names = [];
  let offset = 0;
  const limit = 100;

  while (offset < 2000) {
    const data = await requestWithReauth(panel, (client) =>
      client.getUsers({ offset, limit }),
    );
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

export async function getPasarGuardGroupIds(panel) {
  const data = await requestWithReauth(panel, (client) =>
    client.getGroupsSimple({ all: true, limit: 200 }),
  );
  const groups = data?.groups || data || [];

  return (Array.isArray(groups) ? groups : [])
    .map((group) => Number(group?.id))
    .filter((id) => Number.isInteger(id) && id > 0);
}

function buildTakenSubscriptionKeys(rows) {
  const set = new Set();

  for (const row of rows || []) {
    for (const raw of [row?.clientUsername, row?.remark]) {
      const key = outboundSubscriptionNameKey(raw);
      if (key) set.add(key);
    }
  }

  return set;
}

function computeNextOutboundSerial(prefix, { recentRows = [], panelNames = [] } = {}) {
  const recentNames = (recentRows || []).map((row) => row.clientUsername);
  const recentMax = maxOutboundSerialFromNames(recentNames, prefix);
  const panelMax = maxOutboundSerialFromNames(panelNames, prefix);
  return Math.max(recentMax, panelMax) + 1;
}

async function createPasarGuardUser(panel, {
  username,
  dataLimitBytes,
  expiryTimeMs = 0,
  groupIds = [],
  note = null,
}) {
  const apiUsername = String(username || "").trim();
  const body = {
    username: apiUsername,
    status: "active",
    data_limit: Math.max(0, Math.floor(Number(dataLimitBytes) || 0)),
    expire: expiryTimeMs > 0 ? new Date(expiryTimeMs).toISOString() : 0,
    data_limit_reset_strategy: "no_reset",
  };

  const normalizedGroups = groupIds.map(Number).filter(Boolean);
  if (normalizedGroups.length > 0) {
    body.group_ids = normalizedGroups;
  }
  if (note) body.note = note;

  const created = await requestWithReauth(panel, (client) => client.createUser(body));

  let user = created;
  if (!user?.subscription_url) {
    try {
      user = await fetchOutboundUser(panel, apiUsername);
    } catch {
      // keep created payload
    }
  }

  const subscriptionUrl = buildFullSubscriptionUrl(panel, user?.subscription_url);
  const subId = extractSubToken(user?.subscription_url || subscriptionUrl);

  return {
    success: true,
    clientEmail: apiUsername,
    subscriptionUrl,
    subId,
    groupIds: normalizedGroups,
    user,
    usedTrafficBytes: BigInt(user?.used_traffic ?? 0),
  };
}

export async function provisionOutboundVolumeUser(panel, {
  volumeGb,
  telegramUserId,
  unlimited = false,
}) {
  const prefix = buildOutboundSubscriptionPrefix(panel);
  const dataLimitBytes = unlimited
    ? 0
    : Math.floor(Number(volumeGb) * 1024 * 1024 * 1024);
  const groupIds = await getPasarGuardGroupIds(panel);
  const recentRows = await getRecentOutboundSubscriptionsByPanel(panel.id, 10);
  const takenKeys = buildTakenSubscriptionKeys(recentRows);
  const panelNames = await listPasarGuardUsernames(panel);
  const dbMax = await maxOutboundSerialFromDb(panel.id, prefix);
  let baseNext = computeNextOutboundSerial(prefix, {
    recentRows,
    panelNames,
  });
  baseNext = Math.max(baseNext, dbMax + 1);

  let lastError = "Provision failed";

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const clientEmail = buildOutboundClientEmail(panel, baseNext + attempt);
    const nameKey = outboundSubscriptionNameKey(clientEmail);

    if (takenKeys.has(nameKey)) {
      lastError = "Subscription name recently taken";
      continue;
    }

    if (await findSubscriptionByClientEmailAndPanel(clientEmail, panel.id)) {
      lastError = "Username already taken in database";
      continue;
    }

    if (await pasarguardUserExists(panel, clientEmail)) {
      lastError = "Username already exists on panel";
      continue;
    }

    try {
      const result = await createPasarGuardUser(panel, {
        username: clientEmail,
        dataLimitBytes,
        expiryTimeMs: 0,
        groupIds,
        note: buildPanelClientComment(telegramUserId),
      });

      return {
        ...result,
        remark: clientEmail,
      };
    } catch (err) {
      if (err.status === 409 || /exist|duplicate|already/i.test(err.message || "")) {
        lastError = err.message || "Username already exists on panel";
        continue;
      }

      log.error("outbound-provision", "create user failed", {
        panelId: String(panel.id),
        clientEmail,
        error: err.message,
        status: err.status,
      });
      throw err;
    }
  }

  throw new Error(lastError);
}

export async function provisionOutboundUsageUser(panel, { telegramUserId }) {
  return provisionOutboundVolumeUser(panel, {
    volumeGb: 0,
    telegramUserId,
    unlimited: true,
  });
}

export async function getOutboundUserLiveStats(panel, clientEmail) {
  try {
    const user = await fetchOutboundUser(panel, clientEmail);
    const usedTraffic = BigInt(user?.used_traffic ?? 0);
    const dataLimit = user?.data_limit != null ? BigInt(user.data_limit) : null;
    let remainingBytes = null;
    if (dataLimit != null && dataLimit > 0n) {
      remainingBytes = dataLimit > usedTraffic ? dataLimit - usedTraffic : 0n;
    }

    return {
      available: true,
      usedTraffic,
      dataLimit,
      remainingBytes,
      enabled: user?.status === "active",
      subscriptionUrl: buildFullSubscriptionUrl(panel, user?.subscription_url),
    };
  } catch (err) {
    log.warn("outbound-provision", `live stats fail ${clientEmail} — ${err.message || err}`);
    return { available: false };
  }
}
