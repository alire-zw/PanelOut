import { getSql } from "./postgres.js";

export async function ensureTronTransactionsTable() {
  const sql = getSql();

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS tron_transactions (
      id               BIGSERIAL PRIMARY KEY,
      telegram_user_id BIGINT NOT NULL,
      wallet_id        BIGINT NOT NULL REFERENCES tron_wallets(id),
      tx_hash          VARCHAR(128) NOT NULL UNIQUE,
      from_address     VARCHAR(64) NOT NULL,
      to_address       VARCHAR(64) NOT NULL,
      amount_sun       BIGINT NOT NULL,
      amount_trx       VARCHAR(32) NOT NULL,
      trx_price_irt    BIGINT NOT NULL,
      amount_irt       BIGINT NOT NULL,
      block_number     BIGINT NULL,
      block_timestamp  TIMESTAMPTZ NULL,
      sweep_tx_hash    VARCHAR(128) NULL,
      swept_at         TIMESTAMPTZ NULL,
      date_created     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS tron_transactions_user_idx
    ON tron_transactions (telegram_user_id, date_created DESC)
  `);

  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS tron_transactions_wallet_idx
    ON tron_transactions (wallet_id)
  `);
}

export async function insertTronTransactionCredit(sql, {
  telegramUserId,
  walletId,
  deposit,
  trxPriceIrt,
  amountIrt,
}) {
  const [inserted] = await sql`
    INSERT INTO tron_transactions (
      telegram_user_id,
      wallet_id,
      tx_hash,
      from_address,
      to_address,
      amount_sun,
      amount_trx,
      trx_price_irt,
      amount_irt,
      block_number,
      block_timestamp
    ) VALUES (
      ${telegramUserId},
      ${walletId},
      ${deposit.txHash},
      ${deposit.fromAddress},
      ${deposit.toAddress},
      ${deposit.amountSun.toString()},
      ${deposit.amountTrx},
      ${trxPriceIrt},
      ${amountIrt},
      ${deposit.blockNumber != null ? deposit.blockNumber.toString() : null},
      ${deposit.blockTimestamp}
    )
    ON CONFLICT (tx_hash) DO NOTHING
    RETURNING id
  `;

  if (!inserted) {
    return null;
  }

  const [user] = await sql`
    UPDATE users
    SET balance = balance + ${amountIrt}
    WHERE user_id = ${telegramUserId}
    RETURNING balance
  `;

  return {
    transactionId: Number(inserted.id),
    newBalance: Number(user?.balance ?? 0),
  };
}

export async function markTronTransactionSwept(txHash, sweepTxHash) {
  const sql = getSql();
  await sql`
    UPDATE tron_transactions
    SET
      sweep_tx_hash = ${sweepTxHash},
      swept_at = NOW()
    WHERE tx_hash = ${txHash}
  `;
}

export async function listTronTransactionsForUser(telegramUserId, limit = 100) {
  const sql = getSql();
  return sql`
    SELECT *
    FROM tron_transactions
    WHERE telegram_user_id = ${telegramUserId}
    ORDER BY date_created DESC
    LIMIT ${limit}
  `;
}

export async function findTronTransactionById(telegramUserId, id) {
  const sql = getSql();
  const [row] = await sql`
    SELECT *
    FROM tron_transactions
    WHERE telegram_user_id = ${telegramUserId}
      AND id = ${id}
  `;
  return row ?? null;
}
