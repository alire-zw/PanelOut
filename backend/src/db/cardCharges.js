import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getSql } from "./postgres.js";
import { toPublicBankCard } from "./bankCards.js";
import {
  assertReceiptOwnedBy,
  registerReceiptUpload,
} from "./receiptUploads.js";
import { detectImageMime, resolveUnderRoot } from "../lib/security.js";
import { log } from "../lib/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOADS_ROOT = path.resolve(__dirname, "../../uploads");
export const RECEIPTS_DIR = path.join(UPLOADS_ROOT, "receipts");

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

export async function ensureCardChargesTable() {
  const sql = getSql();

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS card_charge_requests (
      id              BIGSERIAL PRIMARY KEY,
      telegram_user_id BIGINT NOT NULL,
      amount_toman    BIGINT NOT NULL,
      bank_card_id    BIGINT NULL REFERENCES admin_bank_cards(id) ON DELETE SET NULL,
      receipt_path    TEXT NOT NULL,
      receipt_mime    TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'pending',
      admin_note      TEXT NULL,
      reviewed_by     BIGINT NULL,
      reviewed_at     TIMESTAMPTZ NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT card_charge_amount_positive CHECK (amount_toman > 0),
      CONSTRAINT card_charge_status_check CHECK (
        status IN ('pending', 'approved', 'rejected')
      )
    )
  `);

  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS card_charge_status_idx
    ON card_charge_requests (status, created_at DESC)
  `);

  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS card_charge_user_idx
    ON card_charge_requests (telegram_user_id, created_at DESC)
  `);

  await sql.unsafe(`
    ALTER TABLE card_charge_requests
    ADD COLUMN IF NOT EXISTS report_chat_id BIGINT NULL
  `);
  await sql.unsafe(`
    ALTER TABLE card_charge_requests
    ADD COLUMN IF NOT EXISTS report_message_id BIGINT NULL
  `);

  await mkdir(RECEIPTS_DIR, { recursive: true });
}

function extForMime(mime) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

export async function saveReceiptFile({ base64, mimeType, telegramUserId }) {
  const claimedMime = String(mimeType || "").toLowerCase().replace("image/jpg", "image/jpeg");
  const raw = String(base64 || "").replace(/^data:[^;]+;base64,/, "");
  let buffer;
  try {
    buffer = Buffer.from(raw, "base64");
  } catch {
    throw Object.assign(new Error("رسید نامعتبر است"), { status: 400 });
  }

  if (!buffer.length) {
    throw Object.assign(new Error("رسید خالی است"), { status: 400 });
  }
  if (buffer.length > MAX_RECEIPT_BYTES) {
    throw Object.assign(new Error("حجم رسید نباید بیشتر از ۵ مگابایت باشد"), {
      status: 400,
    });
  }

  const detected = detectImageMime(buffer);
  if (!detected || !ALLOWED_MIME.has(detected)) {
    throw Object.assign(new Error("فرمت تصویر رسید باید JPG، PNG یا WEBP باشد"), {
      status: 400,
    });
  }

  // Ignore spoofed client MIME when magic bytes disagree
  if (claimedMime && claimedMime !== detected && claimedMime !== "image/jpg") {
    // still accept if magic is valid — detected wins
  }

  const mime = detected;
  await mkdir(RECEIPTS_DIR, { recursive: true });
  const filename = `${telegramUserId}-${Date.now()}-${randomUUID()}.${extForMime(mime)}`;
  const absolute = path.join(RECEIPTS_DIR, filename);
  await writeFile(absolute, buffer);

  const relativePath = `receipts/${filename}`;
  await registerReceiptUpload({
    telegramUserId,
    relativePath,
    mime,
    sizeBytes: buffer.length,
  });

  return {
    relativePath,
    mime,
    size: buffer.length,
  };
}

export async function uploadReceiptOnly({ base64, mimeType, telegramUserId }) {
  const saved = await saveReceiptFile({ base64, mimeType, telegramUserId });
  log.event(
    "charges",
    `receipt saved ${saved.relativePath} size:${saved.size}`,
  );
  return {
    receiptPath: saved.relativePath,
    receiptMime: saved.mime,
    receiptUrl: `/uploads/${saved.relativePath}`,
    size: saved.size,
  };
}

function toPublicCharge(row, { cardRow = null, userRow = null } = {}) {
  return {
    id: Number(row.id),
    telegramUserId: Number(row.telegram_user_id),
    amountToman: Number(row.amount_toman),
    bankCardId: row.bank_card_id != null ? Number(row.bank_card_id) : null,
    bankCard: cardRow ? toPublicBankCard(cardRow, { includeInactive: true }) : null,
    receiptUrl: `/uploads/${row.receipt_path}`,
    receiptMime: row.receipt_mime,
    status: row.status,
    adminNote: row.admin_note ?? null,
    reviewedBy: row.reviewed_by != null ? Number(row.reviewed_by) : null,
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    reportChatId:
      row.report_chat_id != null ? Number(row.report_chat_id) : null,
    reportMessageId:
      row.report_message_id != null ? Number(row.report_message_id) : null,
    user: userRow
      ? {
          telegramId: Number(userRow.user_id),
          username: userRow.user_name ?? null,
          telegramName: userRow.user_telegram_name ?? null,
          realName: userRow.user_full_name ?? null,
        }
      : null,
  };
}

export async function setCardChargeReportMessage(id, chatId, messageId) {
  const sql = getSql();
  await sql`
    UPDATE card_charge_requests
    SET
      report_chat_id = ${chatId},
      report_message_id = ${messageId}
    WHERE id = ${id}
  `;
}

/** Charge + bank card for admin-report message sync. */
export async function findCardChargeForReport(id) {
  const sql = getSql();
  const [row] = await sql`
    SELECT c.*,
      card.card_number,
      card.sheba,
      card.holder_name,
      card.is_active AS card_is_active,
      card.created_at AS card_created_at,
      card.updated_at AS card_updated_at,
      card.id AS card_row_id
    FROM card_charge_requests c
    LEFT JOIN admin_bank_cards card ON card.id = c.bank_card_id
    WHERE c.id = ${id}
    LIMIT 1
  `;
  if (!row) return null;
  return toPublicCharge(row, {
    cardRow: row.card_row_id
      ? {
          id: row.card_row_id,
          card_number: row.card_number,
          sheba: row.sheba,
          holder_name: row.holder_name,
          is_active: row.card_is_active,
          created_at: row.card_created_at,
          updated_at: row.card_updated_at,
        }
      : null,
  });
}

export async function createCardChargeRequest({
  telegramUserId,
  amountToman,
  bankCardId,
  receiptBase64,
  receiptMimeType,
  receiptPath,
}) {
  const sql = getSql();
  const amount = Math.trunc(Number(amountToman));

  if (!Number.isFinite(amount) || amount < 10_000) {
    throw Object.assign(new Error("حداقل مبلغ شارژ ۱۰٬۰۰۰ تومان است"), { status: 400 });
  }
  if (amount > 50_000_000) {
    throw Object.assign(new Error("حداکثر مبلغ شارژ ۵۰٬۰۰۰٬۰۰۰ تومان است"), {
      status: 400,
    });
  }

  const [card] = await sql`
    SELECT * FROM admin_bank_cards
    WHERE id = ${bankCardId} AND is_active = TRUE
    LIMIT 1
  `;
  if (!card) {
    throw Object.assign(new Error("کارت بانکی فعال یافت نشد"), { status: 400 });
  }

  const pending = await sql`
    SELECT id FROM card_charge_requests
    WHERE telegram_user_id = ${telegramUserId} AND status = 'pending'
    LIMIT 1
  `;
  if (pending.length > 0) {
    throw Object.assign(
      new Error("یک درخواست شارژ در انتظار بررسی دارید؛ تا تعیین وضعیت صبر کنید"),
      { status: 409 },
    );
  }

  let savedPath;
  let savedMime;

  const existingPath = typeof receiptPath === "string" ? receiptPath.trim() : "";
  if (existingPath) {
    if (
      !existingPath.startsWith("receipts/") ||
      existingPath.includes("..") ||
      path.isAbsolute(existingPath)
    ) {
      throw Object.assign(new Error("مسیر رسید نامعتبر است"), { status: 400 });
    }
    const absolute = resolveUnderRoot(UPLOADS_ROOT, existingPath);
    if (!absolute || !existsSync(absolute)) {
      throw Object.assign(new Error("فایل رسید یافت نشد؛ دوباره آپلود کنید"), {
        status: 400,
      });
    }
    await assertReceiptOwnedBy(existingPath, telegramUserId);
    savedPath = existingPath;
    savedMime = String(receiptMimeType || "image/jpeg")
      .toLowerCase()
      .replace("image/jpg", "image/jpeg");
    if (!ALLOWED_MIME.has(savedMime)) {
      throw Object.assign(new Error("فرمت تصویر رسید باید JPG، PNG یا WEBP باشد"), {
        status: 400,
      });
    }
  } else {
    const saved = await saveReceiptFile({
      base64: receiptBase64,
      mimeType: receiptMimeType,
      telegramUserId,
    });
    savedPath = saved.relativePath;
    savedMime = saved.mime;
  }

  const [row] = await sql`
    INSERT INTO card_charge_requests (
      telegram_user_id,
      amount_toman,
      bank_card_id,
      receipt_path,
      receipt_mime
    ) VALUES (
      ${telegramUserId},
      ${amount},
      ${card.id},
      ${savedPath},
      ${savedMime}
    )
    RETURNING *
  `;

  log.event(
    "charges",
    `created #${row.id} tg:${telegramUserId} amount:${amount} card:${card.id}`,
  );
  return toPublicCharge(row, { cardRow: card });
}

export async function listCardChargesForUser(telegramUserId) {
  const sql = getSql();
  const rows = await sql`
    SELECT c.*,
      card.card_number,
      card.sheba,
      card.holder_name,
      card.is_active AS card_is_active,
      card.created_at AS card_created_at,
      card.updated_at AS card_updated_at,
      card.id AS card_row_id
    FROM card_charge_requests c
    LEFT JOIN admin_bank_cards card ON card.id = c.bank_card_id
    WHERE c.telegram_user_id = ${telegramUserId}
    ORDER BY c.created_at DESC
    LIMIT 50
  `;

  return rows.map((row) =>
    toPublicCharge(row, {
      cardRow: row.card_row_id
        ? {
            id: row.card_row_id,
            card_number: row.card_number,
            sheba: row.sheba,
            holder_name: row.holder_name,
            is_active: row.card_is_active,
            created_at: row.card_created_at,
            updated_at: row.card_updated_at,
          }
        : null,
    }),
  );
}

export async function listCardChargesAdmin({ status = "pending" } = {}) {
  const sql = getSql();
  const filterStatus =
    status === "all" || !status
      ? null
      : ["pending", "approved", "rejected"].includes(status)
        ? status
        : "pending";

  const rows = filterStatus
    ? await sql`
        SELECT c.*,
          u.user_name,
          u.user_telegram_name,
          u.user_full_name,
          u.user_id AS u_user_id,
          card.card_number,
          card.sheba,
          card.holder_name,
          card.is_active AS card_is_active,
          card.created_at AS card_created_at,
          card.updated_at AS card_updated_at,
          card.id AS card_row_id
        FROM card_charge_requests c
        LEFT JOIN users u ON u.user_id = c.telegram_user_id
        LEFT JOIN admin_bank_cards card ON card.id = c.bank_card_id
        WHERE c.status = ${filterStatus}
        ORDER BY c.created_at DESC
        LIMIT 100
      `
    : await sql`
        SELECT c.*,
          u.user_name,
          u.user_telegram_name,
          u.user_full_name,
          u.user_id AS u_user_id,
          card.card_number,
          card.sheba,
          card.holder_name,
          card.is_active AS card_is_active,
          card.created_at AS card_created_at,
          card.updated_at AS card_updated_at,
          card.id AS card_row_id
        FROM card_charge_requests c
        LEFT JOIN users u ON u.user_id = c.telegram_user_id
        LEFT JOIN admin_bank_cards card ON card.id = c.bank_card_id
        ORDER BY c.created_at DESC
        LIMIT 100
      `;

  return rows.map((row) =>
    toPublicCharge(row, {
      cardRow: row.card_row_id
        ? {
            id: row.card_row_id,
            card_number: row.card_number,
            sheba: row.sheba,
            holder_name: row.holder_name,
            is_active: row.card_is_active,
            created_at: row.card_created_at,
            updated_at: row.card_updated_at,
          }
        : null,
      userRow: row.u_user_id
        ? {
            user_id: row.u_user_id,
            user_name: row.user_name,
            user_telegram_name: row.user_telegram_name,
            user_full_name: row.user_full_name,
          }
        : null,
    }),
  );
}

export async function findCardChargeById(id) {
  const sql = getSql();
  const [row] = await sql`
    SELECT * FROM card_charge_requests
    WHERE id = ${id}
    LIMIT 1
  `;
  return row ?? null;
}

export async function approveCardCharge(id, reviewerTelegramId) {
  const sql = getSql();

  const result = await sql.begin(async (tx) => {
    const [row] = await tx`
      SELECT * FROM card_charge_requests
      WHERE id = ${id}
      FOR UPDATE
    `;

    if (!row) {
      throw Object.assign(new Error("درخواست یافت نشد"), { status: 404 });
    }
    if (row.status !== "pending") {
      throw Object.assign(new Error("این درخواست قبلاً بررسی شده است"), { status: 409 });
    }

    const [updated] = await tx`
      UPDATE card_charge_requests
      SET
        status = 'approved',
        reviewed_by = ${reviewerTelegramId},
        reviewed_at = NOW(),
        admin_note = NULL
      WHERE id = ${id}
      RETURNING *
    `;

    await tx`
      UPDATE users
      SET balance = balance + ${row.amount_toman}
      WHERE user_id = ${row.telegram_user_id}
    `;

    return updated;
  });

  log.event(
    "charges",
    `approved #${result.id} tg:${result.telegram_user_id} amount:${result.amount_toman} by:${reviewerTelegramId}`,
  );

  const charge = toPublicCharge(result);

  void import("../services/cardChargeNotification.service.js")
    .then(({ notifyCardChargeApproved }) =>
      notifyCardChargeApproved({
        telegramUserId: charge.telegramUserId,
        amountToman: charge.amountToman,
        chargeId: charge.id,
      }),
    )
    .catch(() => {});

  void import("../services/cardChargeReport.service.js")
    .then(({ syncCardChargeAdminReport }) =>
      syncCardChargeAdminReport(charge.id),
    )
    .catch(() => {});

  return charge;
}

export async function rejectCardCharge(id, reviewerTelegramId, note) {
  const sql = getSql();
  const adminNote =
    typeof note === "string" && note.trim() ? note.trim().slice(0, 300) : null;

  const [row] = await sql`
    SELECT * FROM card_charge_requests
    WHERE id = ${id}
    LIMIT 1
  `;

  if (!row) {
    throw Object.assign(new Error("درخواست یافت نشد"), { status: 404 });
  }
  if (row.status !== "pending") {
    throw Object.assign(new Error("این درخواست قبلاً بررسی شده است"), { status: 409 });
  }

  const [updated] = await sql`
    UPDATE card_charge_requests
    SET
      status = 'rejected',
      reviewed_by = ${reviewerTelegramId},
      reviewed_at = NOW(),
      admin_note = ${adminNote}
    WHERE id = ${id} AND status = 'pending'
    RETURNING *
  `;

  if (!updated) {
    throw Object.assign(new Error("این درخواست قبلاً بررسی شده است"), { status: 409 });
  }

  log.event(
    "charges",
    `rejected #${updated.id} tg:${updated.telegram_user_id} by:${reviewerTelegramId}${adminNote ? " with-note" : ""}`,
  );

  const charge = toPublicCharge(updated);

  void import("../services/cardChargeReport.service.js")
    .then(({ syncCardChargeAdminReport }) =>
      syncCardChargeAdminReport(charge.id),
    )
    .catch(() => {});

  return charge;
}
