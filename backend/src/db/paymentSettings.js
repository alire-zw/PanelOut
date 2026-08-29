import { getSql } from "./postgres.js";
import { isValidTronAddress } from "../services/tron/tron.client.js";

const SETTINGS_ID = 1;

export async function ensurePaymentSettingsTable() {
  const sql = getSql();

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS payment_settings (
      id                    BIGINT PRIMARY KEY DEFAULT 1,
      tron_enabled          BOOLEAN NOT NULL DEFAULT TRUE,
      master_wallet_address VARCHAR(64) NULL,
      updated_by            BIGINT NULL,
      date_updated          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT payment_settings_singleton CHECK (id = 1)
    )
  `);

  await sql`
    INSERT INTO payment_settings (id)
    VALUES (${SETTINGS_ID})
    ON CONFLICT (id) DO NOTHING
  `;
}

function toPublicSettings(row) {
  if (!row) return null;
  return {
    tronEnabled: Boolean(row.tron_enabled),
    masterWalletAddress: row.master_wallet_address ?? null,
    updatedBy: row.updated_by != null ? Number(row.updated_by) : null,
    dateUpdated: row.date_updated
      ? new Date(row.date_updated).toISOString()
      : null,
  };
}

export async function getPaymentSettings() {
  const sql = getSql();
  await ensurePaymentSettingsTable();

  const [row] = await sql`
    SELECT *
    FROM payment_settings
    WHERE id = ${SETTINGS_ID}
  `;

  return toPublicSettings(row);
}

export function isTronPaymentAvailable(settings, tronConfigured) {
  return Boolean(tronConfigured && settings?.tronEnabled);
}

export async function getMasterWalletAddress() {
  const settings = await getPaymentSettings();
  return settings?.masterWalletAddress ?? null;
}

export async function setMasterWalletAddress(address, updatedBy) {
  const normalized = String(address || "").trim();
  if (!isValidTronAddress(normalized)) {
    throw Object.assign(new Error("آدرس کیف پول ترون نامعتبر است"), { status: 400 });
  }

  const sql = getSql();
  const [row] = await sql`
    UPDATE payment_settings
    SET
      master_wallet_address = ${normalized},
      updated_by = ${updatedBy ?? null},
      date_updated = NOW()
    WHERE id = ${SETTINGS_ID}
    RETURNING *
  `;
  return toPublicSettings(row);
}

export async function clearMasterWalletAddress(updatedBy) {
  const sql = getSql();
  const [row] = await sql`
    UPDATE payment_settings
    SET
      master_wallet_address = NULL,
      updated_by = ${updatedBy ?? null},
      date_updated = NOW()
    WHERE id = ${SETTINGS_ID}
    RETURNING *
  `;
  return toPublicSettings(row);
}

export async function toggleTronEnabled(updatedBy) {
  const settings = await getPaymentSettings();
  const sql = getSql();
  const [row] = await sql`
    UPDATE payment_settings
    SET
      tron_enabled = ${!settings.tronEnabled},
      updated_by = ${updatedBy ?? null},
      date_updated = NOW()
    WHERE id = ${SETTINGS_ID}
    RETURNING *
  `;
  return toPublicSettings(row);
}

export async function updatePaymentSettings(updatedBy, patch) {
  const current = await getPaymentSettings();
  let tronEnabled = current.tronEnabled;
  let masterWalletAddress = current.masterWalletAddress;

  if (patch.tronEnabled !== undefined) {
    tronEnabled = Boolean(patch.tronEnabled);
  }

  if (patch.masterWalletAddress !== undefined) {
    if (patch.masterWalletAddress === null || patch.masterWalletAddress === "") {
      masterWalletAddress = null;
    } else {
      const normalized = String(patch.masterWalletAddress).trim();
      if (!isValidTronAddress(normalized)) {
        throw Object.assign(new Error("آدرس کیف پول ترون نامعتبر است"), {
          status: 400,
        });
      }
      masterWalletAddress = normalized;
    }
  }

  const sql = getSql();
  const [row] = await sql`
    UPDATE payment_settings
    SET
      tron_enabled = ${tronEnabled},
      master_wallet_address = ${masterWalletAddress},
      updated_by = ${updatedBy ?? null},
      date_updated = NOW()
    WHERE id = ${SETTINGS_ID}
    RETURNING *
  `;
  return toPublicSettings(row);
}
