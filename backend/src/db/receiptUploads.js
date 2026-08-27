import { getSql } from "../db/postgres.js";
import { resolveUnderRoot } from "../lib/security.js";
import { UPLOADS_ROOT } from "./cardCharges.js";

export async function ensureReceiptUploadsTable() {
  const sql = getSql();
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS receipt_uploads (
      id                BIGSERIAL PRIMARY KEY,
      telegram_user_id  BIGINT NOT NULL,
      relative_path     TEXT NOT NULL UNIQUE,
      mime              TEXT NOT NULL,
      size_bytes        INT NOT NULL,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS receipt_uploads_owner_idx
    ON receipt_uploads (telegram_user_id, created_at DESC)
  `);
}

export async function registerReceiptUpload({
  telegramUserId,
  relativePath,
  mime,
  sizeBytes,
}) {
  const sql = getSql();
  const [row] = await sql`
    INSERT INTO receipt_uploads (
      telegram_user_id,
      relative_path,
      mime,
      size_bytes
    ) VALUES (
      ${telegramUserId},
      ${relativePath},
      ${mime},
      ${sizeBytes}
    )
    ON CONFLICT (relative_path) DO UPDATE SET
      mime = EXCLUDED.mime,
      size_bytes = EXCLUDED.size_bytes
    RETURNING *
  `;
  return row;
}

export async function findReceiptUploadByPath(relativePath) {
  const sql = getSql();
  const [row] = await sql`
    SELECT * FROM receipt_uploads
    WHERE relative_path = ${relativePath}
    LIMIT 1
  `;
  return row ?? null;
}

export async function assertReceiptOwnedBy(relativePath, telegramUserId) {
  const row = await findReceiptUploadByPath(relativePath);
  if (!row || Number(row.telegram_user_id) !== Number(telegramUserId)) {
    throw Object.assign(new Error("رسید متعلق به این کاربر نیست"), { status: 403 });
  }
  const absolute = resolveUnderRoot(UPLOADS_ROOT, relativePath);
  if (!absolute) {
    throw Object.assign(new Error("مسیر رسید نامعتبر است"), { status: 400 });
  }
  return row;
}

export async function canAccessReceiptPath(relativePath, { telegramUserId, isAdmin }) {
  if (isAdmin) return true;

  const upload = await findReceiptUploadByPath(relativePath);
  if (upload && Number(upload.telegram_user_id) === Number(telegramUserId)) {
    return true;
  }

  const sql = getSql();
  const [charge] = await sql`
    SELECT id FROM card_charge_requests
    WHERE receipt_path = ${relativePath}
      AND telegram_user_id = ${telegramUserId}
    LIMIT 1
  `;
  return Boolean(charge);
}
