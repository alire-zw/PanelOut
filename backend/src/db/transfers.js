import { getSql } from "./postgres.js";
import { log } from "../lib/logger.js";
import { invalidateWalletTransactionsCache } from "./walletTransactions.js";

const MIN_TRANSFER_TOMAN = 1_000;

export async function ensureTransfersTable() {
  const sql = getSql();

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS wallet_transfers (
      id                 BIGSERIAL PRIMARY KEY,
      transfer_code      TEXT NOT NULL UNIQUE,
      from_telegram_id   BIGINT NOT NULL,
      to_telegram_id     BIGINT NOT NULL,
      amount_toman       BIGINT NOT NULL,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT wallet_transfers_amount_positive CHECK (amount_toman > 0),
      CONSTRAINT wallet_transfers_different_users CHECK (from_telegram_id <> to_telegram_id)
    )
  `);

  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS wallet_transfers_from_idx
    ON wallet_transfers (from_telegram_id, created_at DESC)
  `);

  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS wallet_transfers_to_idx
    ON wallet_transfers (to_telegram_id, created_at DESC)
  `);
}

function toTransferRecipient(row) {
  return {
    telegramId: Number(row.user_id),
    username: row.user_name ?? null,
    telegramName: row.user_telegram_name ?? null,
    realName: row.user_full_name ?? null,
  };
}

export async function searchTransferRecipients(query, { excludeTelegramId, limit = 20 } = {}) {
  const sql = getSql();
  const q = typeof query === "string" ? query.trim().replace(/^@/, "") : "";
  if (q.length < 2) {
    throw Object.assign(new Error("حداقل ۲ نویسه برای جستجو وارد کنید"), { status: 400 });
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 30);
  const like = `%${q.replace(/[%_]/g, "")}%`;
  const asId = /^\d+$/.test(q) ? Number(q) : null;
  const excludeId = Number(excludeTelegramId);

  const rows =
    asId != null && Number.isSafeInteger(asId)
      ? await sql`
          SELECT user_id, user_name, user_telegram_name, user_full_name
          FROM users
          WHERE is_banned = FALSE
            AND user_id <> ${excludeId}
            AND (
              user_id = ${asId}
              OR user_name ILIKE ${like}
              OR user_telegram_name ILIKE ${like}
              OR user_full_name ILIKE ${like}
              OR user_phone ILIKE ${like}
            )
          ORDER BY
            CASE WHEN user_id = ${asId} THEN 0 ELSE 1 END,
            date_created DESC
          LIMIT ${safeLimit}
        `
      : await sql`
          SELECT user_id, user_name, user_telegram_name, user_full_name
          FROM users
          WHERE is_banned = FALSE
            AND user_id <> ${excludeId}
            AND (
              user_name ILIKE ${like}
              OR user_telegram_name ILIKE ${like}
              OR user_full_name ILIKE ${like}
              OR user_phone ILIKE ${like}
            )
          ORDER BY date_created DESC
          LIMIT ${safeLimit}
        `;

  log.event("transfer", `search q:"${q}" count:${rows.length} by:${excludeId}`);
  return rows.map(toTransferRecipient);
}

export async function findTransferByCode(transferCode, viewerTelegramId) {
  const sql = getSql();
  const code = String(transferCode || "").trim();
  if (!code) return null;

  const [row] = await sql`
    SELECT t.*,
      r.user_id AS recipient_user_id,
      r.user_name AS recipient_user_name,
      r.user_telegram_name AS recipient_telegram_name,
      r.user_full_name AS recipient_full_name
    FROM wallet_transfers t
    JOIN users r ON r.user_id = t.to_telegram_id
    WHERE t.transfer_code = ${code}
      AND (t.from_telegram_id = ${viewerTelegramId} OR t.to_telegram_id = ${viewerTelegramId})
    LIMIT 1
  `;

  if (!row) return null;

  return {
    transferId: row.transfer_code,
    amountToman: Number(row.amount_toman),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    fromTelegramId: Number(row.from_telegram_id),
    toTelegramId: Number(row.to_telegram_id),
    recipient: {
      telegramId: Number(row.recipient_user_id),
      username: row.recipient_user_name ?? null,
      telegramName: row.recipient_telegram_name ?? null,
      realName: row.recipient_full_name ?? null,
    },
  };
}

export async function executeTransfer({ fromTelegramId, toTelegramId, amountToman }) {
  const sql = getSql();
  const amount = Math.trunc(Number(amountToman));
  const fromId = Number(fromTelegramId);
  const toId = Number(toTelegramId);

  if (!Number.isFinite(amount) || amount < MIN_TRANSFER_TOMAN) {
    throw Object.assign(
      new Error(`حداقل مبلغ انتقال ${MIN_TRANSFER_TOMAN.toLocaleString("fa-IR")} تومان است`),
      { status: 400 },
    );
  }
  if (!Number.isSafeInteger(toId) || toId <= 0) {
    throw Object.assign(new Error("گیرنده نامعتبر است"), { status: 400 });
  }
  if (fromId === toId) {
    throw Object.assign(new Error("نمی‌توانید به خودتان انتقال دهید"), { status: 400 });
  }

  const result = await sql.begin(async (tx) => {
    const users = await tx`
      SELECT user_id, balance, is_banned, user_name, user_telegram_name, user_full_name
      FROM users
      WHERE user_id = ${fromId} OR user_id = ${toId}
      FOR UPDATE
    `;

    const sender = users.find((row) => Number(row.user_id) === fromId);
    const recipient = users.find((row) => Number(row.user_id) === toId);

    if (!sender) {
      throw Object.assign(new Error("حساب شما یافت نشد"), { status: 404 });
    }
    if (!recipient) {
      throw Object.assign(new Error("گیرنده در مینی‌اپ ثبت‌نام نکرده است"), { status: 404 });
    }
    if (sender.is_banned) {
      throw Object.assign(new Error("حساب شما مسدود است"), { status: 403 });
    }
    if (recipient.is_banned) {
      throw Object.assign(new Error("حساب گیرنده مسدود است"), { status: 403 });
    }

    const balance = Number(sender.balance) || 0;
    if (balance < amount) {
      throw Object.assign(new Error("موجودی کیف پول کافی نیست"), { status: 400 });
    }

    await tx`
      UPDATE users
      SET balance = balance - ${amount}
      WHERE user_id = ${fromId}
    `;

    await tx`
      UPDATE users
      SET balance = balance + ${amount}
      WHERE user_id = ${toId}
    `;

    const transferCode = `TRF-${Date.now()}-${fromId}`;
    const [inserted] = await tx`
      INSERT INTO wallet_transfers (
        transfer_code,
        from_telegram_id,
        to_telegram_id,
        amount_toman
      ) VALUES (
        ${transferCode},
        ${fromId},
        ${toId},
        ${amount}
      )
      RETURNING *
    `;

    return {
      transfer: inserted,
      recipient,
      balanceAfter: balance - amount,
    };
  });

  await Promise.all([
    invalidateWalletTransactionsCache(fromId),
    invalidateWalletTransactionsCache(toId),
  ]);

  log.event(
    "transfer",
    `ok ${result.transfer.transfer_code} from:${fromId} to:${toId} amount:${amount}`,
  );

  return {
    transferId: result.transfer.transfer_code,
    amountToman: amount,
    balanceAfter: String(result.balanceAfter),
    createdAt: result.transfer.created_at
      ? new Date(result.transfer.created_at).toISOString()
      : new Date().toISOString(),
    recipient: toTransferRecipient(result.recipient),
  };
}

