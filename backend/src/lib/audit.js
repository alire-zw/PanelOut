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
