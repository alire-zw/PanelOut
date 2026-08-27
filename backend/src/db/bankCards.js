import { getSql } from "./postgres.js";
import { log } from "../lib/logger.js";

export async function ensureBankCardsTable() {
  const sql = getSql();

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS admin_bank_cards (
      id            BIGSERIAL PRIMARY KEY,
      card_number   TEXT NOT NULL,
      sheba         TEXT NULL,
      holder_name   TEXT NOT NULL,
      is_active     BOOLEAN NOT NULL DEFAULT TRUE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT admin_bank_cards_card_number_digits CHECK (card_number ~ '^[0-9]{16}$'),
      CONSTRAINT admin_bank_cards_sheba_format CHECK (
        sheba IS NULL OR sheba ~ '^IR[0-9]{24}$'
      )
    )
  `);

  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS admin_bank_cards_active_idx
    ON admin_bank_cards (is_active, id DESC)
  `);
}

function normalizeCardNumber(raw) {
  return String(raw ?? "")
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/\D/g, "");
}

function normalizeSheba(raw) {
  if (raw == null || String(raw).trim() === "") return null;
  const value = String(raw)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  return value;
}

export function toPublicBankCard(row, { includeInactive = false } = {}) {
  if (!row) return null;
  if (!includeInactive && !row.is_active) return null;

  return {
    id: Number(row.id),
    cardNumber: row.card_number,
    sheba: row.sheba ?? null,
    holderName: row.holder_name,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

export async function listBankCards({ activeOnly = false } = {}) {
  const sql = getSql();
  const rows = activeOnly
    ? await sql`
        SELECT * FROM admin_bank_cards
        WHERE is_active = TRUE
        ORDER BY id DESC
      `
    : await sql`
        SELECT * FROM admin_bank_cards
        ORDER BY is_active DESC, id DESC
      `;

  return rows.map((row) => toPublicBankCard(row, { includeInactive: true }));
}

export async function findBankCardById(id) {
  const sql = getSql();
  const [row] = await sql`
    SELECT * FROM admin_bank_cards
    WHERE id = ${id}
    LIMIT 1
  `;
  return row ?? null;
}

export async function createBankCard({ cardNumber, sheba, holderName }) {
  const sql = getSql();
  const digits = normalizeCardNumber(cardNumber);
  const shebaValue = normalizeSheba(sheba);
  const name = typeof holderName === "string" ? holderName.trim() : "";

  if (!/^\d{16}$/.test(digits)) {
    throw Object.assign(new Error("شماره کارت باید ۱۶ رقم باشد"), { status: 400 });
  }
  if (shebaValue && !/^IR\d{24}$/.test(shebaValue)) {
    throw Object.assign(new Error("شبا باید با IR و ۲۴ رقم باشد"), { status: 400 });
  }
  if (!name || name.length > 80) {
    throw Object.assign(new Error("نام صاحب کارت معتبر نیست"), { status: 400 });
  }

  const [row] = await sql`
    INSERT INTO admin_bank_cards (card_number, sheba, holder_name)
    VALUES (${digits}, ${shebaValue}, ${name})
    RETURNING *
  `;

  log.event("cards", `created #${row.id} ****${digits.slice(-4)}`);
  return toPublicBankCard(row, { includeInactive: true });
}

export async function updateBankCard(id, { cardNumber, sheba, holderName, isActive } = {}) {
  const sql = getSql();
  const patch = {};
  const columns = [];

  if (cardNumber !== undefined) {
    const digits = normalizeCardNumber(cardNumber);
    if (!/^\d{16}$/.test(digits)) {
      throw Object.assign(new Error("شماره کارت باید ۱۶ رقم باشد"), { status: 400 });
    }
    patch.card_number = digits;
    columns.push("card_number");
  }

  if (sheba !== undefined) {
    const shebaValue = normalizeSheba(sheba);
    if (shebaValue && !/^IR\d{24}$/.test(shebaValue)) {
      throw Object.assign(new Error("شبا باید با IR و ۲۴ رقم باشد"), { status: 400 });
    }
    patch.sheba = shebaValue;
    columns.push("sheba");
  }

  if (holderName !== undefined) {
    const name = typeof holderName === "string" ? holderName.trim() : "";
    if (!name || name.length > 80) {
      throw Object.assign(new Error("نام صاحب کارت معتبر نیست"), { status: 400 });
    }
    patch.holder_name = name;
    columns.push("holder_name");
  }

  if (isActive !== undefined) {
    patch.is_active = Boolean(isActive);
    columns.push("is_active");
  }

  if (columns.length === 0) {
    throw Object.assign(new Error("هیچ فیلدی برای به‌روزرسانی ارسال نشده"), { status: 400 });
  }

  patch.updated_at = new Date();
  columns.push("updated_at");

  const [row] = await sql`
    UPDATE admin_bank_cards
    SET ${sql(patch, columns)}
    WHERE id = ${id}
    RETURNING *
  `;

  if (!row) {
    throw Object.assign(new Error("کارت یافت نشد"), { status: 404 });
  }

  log.event("cards", `updated #${row.id} fields:${columns.filter((c) => c !== "updated_at").join(",")}`);
  return toPublicBankCard(row, { includeInactive: true });
}

export async function deleteBankCard(id) {
  const sql = getSql();
  const [row] = await sql`
    DELETE FROM admin_bank_cards
    WHERE id = ${id}
    RETURNING *
  `;
  if (!row) {
    throw Object.assign(new Error("کارت یافت نشد"), { status: 404 });
  }
  log.event("cards", `deleted #${row.id}`);
  return toPublicBankCard(row, { includeInactive: true });
}
