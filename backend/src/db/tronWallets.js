import { getSql } from "./postgres.js";

export async function ensureTronWalletsTable() {
  const sql = getSql();

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS tron_wallets (
      id              BIGSERIAL PRIMARY KEY,
      telegram_user_id BIGINT NOT NULL UNIQUE,
      address         VARCHAR(64) NOT NULL UNIQUE,
      private_key     VARCHAR(128) NOT NULL,
      public_key      VARCHAR(256) NOT NULL,
      last_checked_at TIMESTAMPTZ NULL,
      date_created    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      date_updated    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS tron_wallets_address_idx
    ON tron_wallets (address)
  `);
}

function toWalletRow(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    userId: Number(row.telegram_user_id),
    address: row.address,
    privateKey: row.private_key,
    publicKey: row.public_key,
    lastCheckedAt: row.last_checked_at
      ? new Date(row.last_checked_at).toISOString()
      : null,
    dateCreated: row.date_created
      ? new Date(row.date_created).toISOString()
      : null,
    dateUpdated: row.date_updated
      ? new Date(row.date_updated).toISOString()
      : null,
  };
}

export async function findTronWalletByUserId(telegramUserId) {
  const sql = getSql();
  const [row] = await sql`
    SELECT *
    FROM tron_wallets
    WHERE telegram_user_id = ${telegramUserId}
  `;
  return toWalletRow(row);
}

export async function createTronWallet({
  telegramUserId,
  address,
  privateKey,
  publicKey,
}) {
  const sql = getSql();
  const [row] = await sql`
    INSERT INTO tron_wallets (
      telegram_user_id,
      address,
      private_key,
      public_key
    ) VALUES (
      ${telegramUserId},
      ${address},
      ${privateKey},
      ${publicKey}
    )
    RETURNING *
  `;
  return toWalletRow(row);
}

export async function listTronWallets() {
  const sql = getSql();
  const rows = await sql`
    SELECT *
    FROM tron_wallets
    ORDER BY id ASC
  `;
  return rows.map(toWalletRow);
}

export async function touchTronWalletChecked(walletId) {
  const sql = getSql();
  await sql`
    UPDATE tron_wallets
    SET
      last_checked_at = NOW(),
      date_updated = NOW()
    WHERE id = ${walletId}
  `;
}
