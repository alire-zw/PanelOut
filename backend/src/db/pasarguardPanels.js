import { getSql } from "./postgres.js";
import { redis } from "./redis.js";
import { log } from "../lib/logger.js";
import {
  clearPasarGuardClientCache,
  getPasarGuardStats,
  parsePasarGuardPanelUrl,
  verifyPasarGuardConnection,
} from "../lib/pasarguardService.js";

const SHOP_ACTIVITY_KEY = "shop:activity:v2";
const SHOP_ADMIN_USERNAMES_KEY = "shop:admin_usernames:v1";
/** Slightly longer than refresh interval so cache never expires between job runs. */
const SHOP_ACTIVITY_TTL_SECONDS = 15 * 60;

function emptyShopActivity() {
  return {
    trafficBytes: 0,
    totalUsers: 0,
    onlineUsers: 0,
    activeUsers: 0,
    resellerCount: 0,
    uptimeSeconds: null,
    panelCount: 0,
    connectedPanelCount: 0,
    cachedAt: null,
  };
}

export class PasarGuardPanelError extends Error {
  constructor(message, code = "INVALID_INPUT") {
    super(message);
    this.name = "PasarGuardPanelError";
    this.code = code;
    this.status =
      code === "NOT_FOUND"
        ? 404
        : code === "CONNECTION_FAILED"
          ? 409
          : code === "DUPLICATE"
            ? 409
            : 400;
  }
}

const TOGGLE_FIELDS = Object.freeze({
  active: "is_active",
  sales: "sales_enabled",
  renewal: "renewal_enabled",
  outboundVolume: "outbound_volume_enabled",
  outboundUsage: "outbound_usage_enabled",
  panelVolume: "panel_volume_enabled",
  panelUsage: "panel_usage_enabled",
  panelUnlimited: "panel_unlimited_enabled",
});

export async function ensurePasarGuardPanelsTable() {
  const sql = getSql();
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS pasarguard_panels (
      id                      BIGSERIAL PRIMARY KEY,
      name                    TEXT NOT NULL,
      panel_url               TEXT NOT NULL,
      host                    TEXT NOT NULL,
      port                    INT NOT NULL DEFAULT 443,
      admin_username          TEXT NOT NULL,
      admin_password          TEXT NOT NULL,
      remark                  TEXT,
      sub_public_base_url     TEXT,
      priority                INT NOT NULL DEFAULT 0,
      is_active               BOOLEAN NOT NULL DEFAULT TRUE,
      sales_enabled           BOOLEAN NOT NULL DEFAULT TRUE,
      renewal_enabled         BOOLEAN NOT NULL DEFAULT TRUE,
      outbound_volume_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      outbound_usage_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
      panel_volume_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
      panel_usage_enabled     BOOLEAN NOT NULL DEFAULT TRUE,
      panel_unlimited_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS pasarguard_panels_priority_idx
      ON pasarguard_panels (priority ASC, created_at DESC)
  `);
  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS pasarguard_panels_active_idx
      ON pasarguard_panels (is_active)
  `);
  await sql.unsafe(`
    UPDATE pasarguard_panels
    SET sales_enabled = TRUE
    WHERE is_active = TRUE AND sales_enabled = FALSE
  `);
}

function rowToPanel(row, { includePassword = false } = {}) {
  if (!row) return null;

  const panel = {
    id: String(row.id),
    name: row.name,
    panelUrl: row.panel_url,
    host: row.host,
    port: Number(row.port),
    adminUsername: row.admin_username,
    remark: row.remark,
    subPublicBaseUrl: row.sub_public_base_url,
    priority: Number(row.priority),
    isActive: Boolean(row.is_active),
    salesEnabled: Boolean(row.sales_enabled),
    renewalEnabled: Boolean(row.renewal_enabled),
    outboundVolumeEnabled: Boolean(row.outbound_volume_enabled),
    outboundUsageEnabled: Boolean(row.outbound_usage_enabled),
    panelVolumeEnabled: Boolean(row.panel_volume_enabled),
    panelUsageEnabled: Boolean(row.panel_usage_enabled),
    panelUnlimitedEnabled: Boolean(row.panel_unlimited_enabled),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    hasPassword: Boolean(row.admin_password),
  };

  if (includePassword) {
    panel.adminPassword = row.admin_password;
  }

  return panel;
}

function panelRowToClient(panel) {
  return {
    id: panel.id,
    panelUrl: panel.panelUrl,
    host: panel.host,
    port: panel.port,
    adminUsername: panel.adminUsername,
    adminPassword: panel.adminPassword,
  };
}

function normalizeRemark(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  const skip = new Set(["-", "ندار", "خالی", ""]);
  if (skip.has(trimmed.toLowerCase())) return null;
  return trimmed;
}

function normalizeSubPublicBaseUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  const skip = new Set(["-", "ندار", "خالی", ""]);
  if (skip.has(trimmed.toLowerCase())) return null;

  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProto);
    return `${url.origin}${url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "")}/`;
  } catch {
    throw new PasarGuardPanelError("آدرس ساب عمومی نامعتبر است", "INVALID_URL");
  }
}

async function getNextPriority() {
  const sql = getSql();
  const rows = await sql`SELECT COALESCE(MAX(priority), -1) + 1 AS next FROM pasarguard_panels`;
  return Number(rows[0]?.next ?? 0);
}

export async function listPasarGuardPanels({ withConnection = false, withStats = false } = {}) {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM pasarguard_panels
    ORDER BY priority ASC, created_at DESC
  `;

  const panels = rows.map((row) => rowToPanel(row));

  if (!withConnection && !withStats) {
    return { items: panels };
  }

  const enriched = await Promise.all(
    panels.map(async (panel) => {
      const full = await findPasarGuardPanelById(panel.id, { includePassword: true });
      const connection = withConnection
        ? await verifyPasarGuardConnection(panelRowToClient(full))
        : null;
      const statsResult =
        withStats && connection?.success !== false
          ? await getPasarGuardStats(panelRowToClient(full))
          : null;

      return {
        ...panel,
        connection: connection
          ? { ok: connection.success, error: connection.error || null }
          : undefined,
        stats: statsResult?.success ? statsResult.stats : statsResult?.error ? null : undefined,
        statsError: statsResult && !statsResult.success ? statsResult.error : null,
      };
    }),
  );

  return { items: enriched };
}

export async function findPasarGuardPanelById(id, { includePassword = false } = {}) {
  const panelId = Number(id);
  if (!Number.isInteger(panelId) || panelId <= 0) {
    throw new PasarGuardPanelError("شناسه پنل نامعتبر است", "INVALID_ID");
  }

  const sql = getSql();
  const rows = await sql`SELECT * FROM pasarguard_panels WHERE id = ${panelId} LIMIT 1`;
  const panel = rowToPanel(rows[0], { includePassword });
  if (!panel) {
    throw new PasarGuardPanelError("پنل پیدا نشد", "NOT_FOUND");
  }
  return panel;
}

export async function getPasarGuardPanelDetail(id) {
  const panel = await findPasarGuardPanelById(id, { includePassword: true });
  const clientPanel = panelRowToClient(panel);
  const [connection, statsResult] = await Promise.all([
    verifyPasarGuardConnection(clientPanel),
    getPasarGuardStats(clientPanel),
  ]);

  const { adminPassword: _pwd, ...safePanel } = panel;

  return {
    panel: safePanel,
    connection: { ok: connection.success, error: connection.error || null },
    stats: statsResult.success ? statsResult.stats : null,
    statsError: statsResult.success ? null : statsResult.error,
  };
}

export async function createPasarGuardPanel(input) {
  const name = String(input.name || "").trim();
  const panelUrlRaw = String(input.panelUrl || "").trim();
  const adminUsername = String(input.adminUsername || "").trim();
  const adminPassword = String(input.adminPassword || "");

  if (!name) throw new PasarGuardPanelError("نام پنل الزامی است");
  if (!panelUrlRaw) throw new PasarGuardPanelError("آدرس پنل الزامی است");
  if (!adminUsername) throw new PasarGuardPanelError("نام کاربری ادمین الزامی است");
  if (!adminPassword) throw new PasarGuardPanelError("رمز عبور ادمین الزامی است");

  const parsed = parsePasarGuardPanelUrl(panelUrlRaw);
  const remark = normalizeRemark(input.remark);
  const subPublicBaseUrl = input.subPublicBaseUrl
    ? normalizeSubPublicBaseUrl(input.subPublicBaseUrl)
    : null;
  const priority =
    input.priority != null && Number.isFinite(Number(input.priority))
      ? Number(input.priority)
      : await getNextPriority();

  const verifyTarget = {
    panelUrl: parsed.baseUrl,
    host: parsed.host,
    port: parsed.port,
    adminUsername,
    adminPassword,
  };

  const connection = await verifyPasarGuardConnection(verifyTarget);
  if (!connection.success) {
    throw new PasarGuardPanelError(
      connection.error || "اتصال به پنل برقرار نشد",
      "CONNECTION_FAILED",
    );
  }

  const sql = getSql();
  const rows = await sql`
    INSERT INTO pasarguard_panels (
      name, panel_url, host, port, admin_username, admin_password,
      remark, sub_public_base_url, priority
    ) VALUES (
      ${name}, ${parsed.baseUrl}, ${parsed.host}, ${parsed.port},
      ${adminUsername}, ${adminPassword}, ${remark}, ${subPublicBaseUrl}, ${priority}
    )
    RETURNING *
  `;

  return rowToPanel(rows[0]);
}

export async function updatePasarGuardPanel(id, input) {
  const existing = await findPasarGuardPanelById(id, { includePassword: true });
  const patch = {};

  if (input.name !== undefined) {
    const name = String(input.name || "").trim();
    if (!name) throw new PasarGuardPanelError("نام پنل الزامی است");
    patch.name = name;
  }

  if (input.panelUrl !== undefined) {
    const parsed = parsePasarGuardPanelUrl(input.panelUrl);
    patch.panel_url = parsed.baseUrl;
    patch.host = parsed.host;
    patch.port = parsed.port;
  }

  if (input.adminUsername !== undefined) {
    const adminUsername = String(input.adminUsername || "").trim();
    if (!adminUsername) throw new PasarGuardPanelError("نام کاربری ادمین الزامی است");
    patch.admin_username = adminUsername;
  }

  if (input.adminPassword !== undefined) {
    const adminPassword = String(input.adminPassword || "");
    if (!adminPassword) throw new PasarGuardPanelError("رمز عبور ادمین الزامی است");
    patch.admin_password = adminPassword;
  }

  if (input.remark !== undefined) {
    patch.remark = normalizeRemark(input.remark);
  }

  if (input.subPublicBaseUrl !== undefined) {
    patch.sub_public_base_url = normalizeSubPublicBaseUrl(input.subPublicBaseUrl);
  }

  if (input.priority !== undefined) {
    const priority = Number(input.priority);
    if (!Number.isInteger(priority) || priority < 0) {
      throw new PasarGuardPanelError("اولویت نامعتبر است", "INVALID_PRIORITY");
    }
    patch.priority = priority;
  }

  const boolFields = [
    ["isActive", "is_active"],
    ["salesEnabled", "sales_enabled"],
    ["renewalEnabled", "renewal_enabled"],
    ["outboundVolumeEnabled", "outbound_volume_enabled"],
    ["outboundUsageEnabled", "outbound_usage_enabled"],
    ["panelVolumeEnabled", "panel_volume_enabled"],
    ["panelUsageEnabled", "panel_usage_enabled"],
    ["panelUnlimitedEnabled", "panel_unlimited_enabled"],
  ];

  for (const [inputKey, dbKey] of boolFields) {
    if (input[inputKey] !== undefined) {
      patch[dbKey] = Boolean(input[inputKey]);
    }
  }

  if (Object.keys(patch).length === 0) {
    return rowToPanel(
      (
        await getSql()`SELECT * FROM pasarguard_panels WHERE id = ${Number(id)} LIMIT 1`
      )[0],
    );
  }

  const next = {
    ...existing,
    ...Object.fromEntries(
      Object.entries(patch).map(([key, value]) => {
        const map = {
          panel_url: "panelUrl",
          admin_username: "adminUsername",
          admin_password: "adminPassword",
          sub_public_base_url: "subPublicBaseUrl",
          is_active: "isActive",
          sales_enabled: "salesEnabled",
          renewal_enabled: "renewalEnabled",
          outbound_volume_enabled: "outboundVolumeEnabled",
          outbound_usage_enabled: "outboundUsageEnabled",
          panel_volume_enabled: "panelVolumeEnabled",
          panel_usage_enabled: "panelUsageEnabled",
          panel_unlimited_enabled: "panelUnlimitedEnabled",
        };
        return [map[key] || key, value];
      }),
    ),
  };

  if (
    patch.panel_url ||
    patch.admin_username ||
    patch.admin_password ||
    patch.host ||
    patch.port
  ) {
    const connection = await verifyPasarGuardConnection(panelRowToClient(next));
    if (!connection.success) {
      throw new PasarGuardPanelError(
        connection.error || "اتصال به پنل برقرار نشد",
        "CONNECTION_FAILED",
      );
    }
    clearPasarGuardClientCache(existing);
  }

  if (patch.is_active === false) {
    patch.sales_enabled = false;
  }

  const sql = getSql();
  const setClauses = Object.keys(patch)
    .map((key, index) => `${key} = $${index + 2}`)
    .join(", ");

  const values = [Number(id), ...Object.values(patch)];
  const rows = await sql.unsafe(
    `UPDATE pasarguard_panels SET ${setClauses}, updated_at = NOW() WHERE id = $1 RETURNING *`,
    values,
  );

  return rowToPanel(rows[0]);
}

export async function deletePasarGuardPanel(id) {
  const existing = await findPasarGuardPanelById(id, { includePassword: true });
  clearPasarGuardClientCache(existing);
  const sql = getSql();
  await sql`DELETE FROM pasarguard_panels WHERE id = ${Number(id)}`;
  return { deleted: true, id: String(id) };
}

export async function testPasarGuardPanelConnection(id) {
  const panel = await findPasarGuardPanelById(id, { includePassword: true });
  const connection = await verifyPasarGuardConnection(panelRowToClient(panel));
  return {
    ok: connection.success,
    error: connection.error || null,
  };
}

export async function togglePasarGuardPanelFlag(id, kind) {
  const column = TOGGLE_FIELDS[kind];
  if (!column) {
    throw new PasarGuardPanelError("نوع تغییر نامعتبر است", "INVALID_TOGGLE");
  }

  const panel = await findPasarGuardPanelById(id, { includePassword: true });
  const fieldMap = {
    is_active: "isActive",
    sales_enabled: "salesEnabled",
    renewal_enabled: "renewalEnabled",
    outbound_volume_enabled: "outboundVolumeEnabled",
    outbound_usage_enabled: "outboundUsageEnabled",
    panel_volume_enabled: "panelVolumeEnabled",
    panel_usage_enabled: "panelUsageEnabled",
    panel_unlimited_enabled: "panelUnlimitedEnabled",
  };

  const field = fieldMap[column];
  const current = Boolean(panel[field]);

  if (column === "sales_enabled" && !panel.isActive) {
    throw new PasarGuardPanelError("پنل غیرفعال است", "PANEL_INACTIVE");
  }

  const patch = { [field]: !current };
  if (column === "is_active" && !current) {
    patch.salesEnabled = true;
  }
  if (column === "is_active" && current) {
    patch.salesEnabled = false;
  }

  return updatePasarGuardPanel(id, patch);
}

export async function reorderPasarGuardPanels(order) {
  if (!Array.isArray(order) || order.length === 0) {
    throw new PasarGuardPanelError("ترتیب اولویت نامعتبر است", "INVALID_ORDER");
  }

  const sql = getSql();
  await sql.begin(async (tx) => {
    for (const item of order) {
      const panelId = Number(item.id);
      const priority = Number(item.priority);
      if (!Number.isInteger(panelId) || panelId <= 0) {
        throw new PasarGuardPanelError("شناسه پنل نامعتبر است", "INVALID_ID");
      }
      if (!Number.isInteger(priority) || priority < 0) {
        throw new PasarGuardPanelError("اولویت نامعتبر است", "INVALID_PRIORITY");
      }
      await tx`
        UPDATE pasarguard_panels
        SET priority = ${priority}, updated_at = NOW()
        WHERE id = ${panelId}
      `;
    }
  });

  return listPasarGuardPanels();
}

export async function refreshShopActivityStats() {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM pasarguard_panels
    WHERE is_active = TRUE
    ORDER BY priority ASC, created_at DESC
  `;

  log.event(
    "shop",
    `active panels in order: ${rows.map((r) => `#${r.id} "${r.name}" prio:${r.priority} sales:${r.sales_enabled} usage:${r.panel_usage_enabled} volume:${r.panel_volume_enabled}`).join(" | ")}`,
  );

  const results = await Promise.all(
    rows.map(async (row) => {
      const panel = rowToPanel(row, { includePassword: true });
      return getPasarGuardStats(panelRowToClient(panel));
    }),
  );

  let trafficBytes = 0;
  let totalUsers = 0;
  let onlineUsers = 0;
  let activeUsers = 0;
  let resellerCount = 0;
  let uptimeSeconds = 0;
  let connected = 0;
  const takenUsernames = new Set();

  for (const result of results) {
    if (!result?.success || !result.stats) continue;
    connected += 1;
    trafficBytes += Number(result.stats.totalTraffic) || 0;
    totalUsers += Number(result.stats.totalUsers) || 0;
    onlineUsers += Number(result.stats.onlineUsers) || 0;
    activeUsers += Number(result.stats.activeUsers) || 0;
    resellerCount += Number(result.stats.adminCount) || 0;
    const up = Number(result.stats.uptime);
    if (Number.isFinite(up) && up > uptimeSeconds) uptimeSeconds = up;

    if (Array.isArray(result.adminUsernames)) {
      for (const uname of result.adminUsernames) {
        if (uname) takenUsernames.add(String(uname).trim().toLowerCase());
      }
    }
  }

  try {
    const subRows = await sql`
      SELECT client_username FROM user_panel_subscriptions
      WHERE client_username IS NOT NULL
    `;
    for (const sub of subRows) {
      if (sub.client_username) {
        takenUsernames.add(String(sub.client_username).trim().toLowerCase());
      }
    }
  } catch {
    // ignore if table not ready yet
  }

  const payload = {
    trafficBytes,
    totalUsers,
    onlineUsers,
    activeUsers,
    resellerCount,
    uptimeSeconds: uptimeSeconds > 0 ? uptimeSeconds : null,
    panelCount: rows.length,
    connectedPanelCount: connected,
    cachedAt: new Date().toISOString(),
  };

  await Promise.all([
    redis.set(
      SHOP_ACTIVITY_KEY,
      JSON.stringify(payload),
      "EX",
      SHOP_ACTIVITY_TTL_SECONDS,
    ),
    redis.set(
      SHOP_ADMIN_USERNAMES_KEY,
      JSON.stringify(Array.from(takenUsernames)),
      "EX",
      SHOP_ACTIVITY_TTL_SECONDS,
    ),
  ]);

  log.event(
    "shop",
    `activity refresh panels:${connected}/${rows.length} users:${totalUsers} admins:${resellerCount} usernames:${takenUsernames.size}`,
  );
  return payload;
}

/** Fast read — Redis only; never calls PasarGuard panels. */
export async function getShopActivityStats() {
  const cached = await redis.get(SHOP_ACTIVITY_KEY);
  if (!cached) {
    return emptyShopActivity();
  }

  try {
    return JSON.parse(cached);
  } catch {
    await redis.del(SHOP_ACTIVITY_KEY);
    return emptyShopActivity();
  }
}

export async function getCachedTakenUsernames() {
  const cached = await redis.get(SHOP_ADMIN_USERNAMES_KEY);
  if (!cached) return null;
  try {
    const parsed = JSON.parse(cached);
    if (Array.isArray(parsed)) {
      return new Set(parsed.map((u) => String(u).toLowerCase()));
    }
    return null;
  } catch {
    return null;
  }
}

export async function addTakenUsername(username) {
  if (!username) return;
  const norm = String(username).trim().toLowerCase();
  try {
    const cached = await redis.get(SHOP_ADMIN_USERNAMES_KEY);
    const list = cached ? JSON.parse(cached) : [];
    if (Array.isArray(list) && !list.includes(norm)) {
      list.push(norm);
      await redis.set(
        SHOP_ADMIN_USERNAMES_KEY,
        JSON.stringify(list),
        "EX",
        SHOP_ACTIVITY_TTL_SECONDS,
      );
    }
  } catch {
    // ignore cache write error
  }
}

export async function isPanelUsernameTaken(rawUsername) {
  const username = String(rawUsername || "").trim().toLowerCase();
  if (!username) return false;

  const cached = await getCachedTakenUsernames();
  if (cached) {
    if (cached.has(username)) return true;
  }

  const sql = getSql();
  try {
    const dbMatch = await sql`
      SELECT id FROM user_panel_subscriptions
      WHERE LOWER(client_username) = ${username}
      LIMIT 1
    `;
    if (dbMatch.length > 0) return true;
  } catch {
    // ignore
  }

  if (!cached) {
    void refreshShopActivityStats().catch(() => {});
  }

  return false;
}

export async function countPasarGuardPanels() {
  const sql = getSql();
  const rows = await sql`SELECT COUNT(*)::int AS count FROM pasarguard_panels`;
  return Number(rows[0]?.count ?? 0);
}
