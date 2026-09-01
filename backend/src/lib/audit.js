import { getSql } from "../db/postgres.js";
import { getClientIp } from "./security.js";
import { log } from "./logger.js";

export async function ensureAuditLogTable() {
  const sql = getSql();
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id              BIGSERIAL PRIMARY KEY,
      actor_telegram_id BIGINT NOT NULL,
      actor_role      TEXT NOT NULL,
      action          TEXT NOT NULL,
      target_type     TEXT NULL,
      target_id       TEXT NULL,
      meta            JSONB NULL,
      ip              TEXT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS admin_audit_actor_idx
    ON admin_audit_logs (actor_telegram_id, created_at DESC)
  `);
  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS admin_audit_target_idx
    ON admin_audit_logs (target_type, target_id, created_at DESC)
  `);
}

const ROLE_TO_API = {
  User: "user",
  Admin: "admin",
  Supervisor: "supervisor",
};

function rowToAuditLog(row) {
  const actorRole =
    ROLE_TO_API[row.actor_db_role] || row.actor_role || "user";

  return {
    id: String(row.id),
    action: row.action,
    targetType: row.target_type ?? null,
    targetId: row.target_id ?? null,
    meta: row.meta ?? null,
    ip: row.ip ?? null,
    createdAt: new Date(row.created_at).toISOString(),
    actor: {
      telegramId: Number(row.actor_telegram_id),
      role: actorRole,
      username: row.actor_username ?? null,
      displayName: row.actor_display_name ?? null,
    },
  };
}

export async function listAdminAuditForUser(telegramId, { limit = 50 } = {}) {
  const sql = getSql();
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const targetId = String(telegramId);

  const rows = await sql`
    SELECT
      a.*,
      u.user_name AS actor_username,
      COALESCE(u.user_full_name, u.user_telegram_name) AS actor_display_name,
      u.user_role AS actor_db_role
    FROM admin_audit_logs a
    LEFT JOIN users u ON u.user_id = a.actor_telegram_id
    WHERE
      (a.target_type = 'user' AND a.target_id = ${targetId})
      OR (a.meta->>'targetUserTelegramId') = ${targetId}
    ORDER BY a.created_at DESC
    LIMIT ${safeLimit}
  `;

  return rows.map(rowToAuditLog);
}

export async function writeAdminAudit({
  req,
  actor,
  action,
  targetType = null,
  targetId = null,
  meta = null,
}) {
  const sql = getSql();
  try {
    await sql`
      INSERT INTO admin_audit_logs (
        actor_telegram_id,
        actor_role,
        action,
        target_type,
        target_id,
        meta,
        ip
      ) VALUES (
        ${actor.telegramId},
        ${actor.role},
        ${action},
        ${targetType},
        ${targetId != null ? String(targetId) : null},
        ${meta == null ? null : sql.json(meta)},
        ${getClientIp(req)}
      )
    `;
  } catch (error) {
    log.warn("audit", error.message || "failed to write audit log");
  }
}
