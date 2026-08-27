import { getSql } from "./postgres.js";
import { redis } from "./redis.js";
import { log } from "../lib/logger.js";

const DATA_KEY = (userId) => `wallet:txs:data:${userId}`;
const VER_KEY = (userId) => `wallet:txs:ver:${userId}`;
const CACHE_TTL_SECONDS = 60 * 10;

function formatFaDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function mapChargeStatus(status) {
  if (status === "approved") return "success";
  if (status === "rejected") return "failed";
  return "pending";
}

function chargeTitle(status) {
  if (status === "approved") return "شارژ کارت‌به‌کارت";
  if (status === "rejected") return "رد شارژ کارت‌به‌کارت";
  return "در انتظار تأیید شارژ";
}

function emptyTxBase() {
  return {
    expiresAt: null,
    walletAmountToman: null,
    gatewayAmountToman: null,
    categorySlug: null,
    recipientUsername: null,
    recipientName: null,
    quantity: null,
    counterpartyTelegramId: null,
    trackId: null,
    refNumber: null,
    cardNumber: null,
    amountTrx: null,
    incomingTxHash: null,
    adminNote: null,
  };
}

function mapCardChargeRow(row) {
  const createdAt = row.created_at ? new Date(row.created_at).toISOString() : null;
  const reviewedAt = row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null;
  const status = mapChargeStatus(row.status);

  return {
    ...emptyTxBase(),
    id: `card-charge-${row.id}`,
    title: chargeTitle(row.status),
    date: createdAt ? formatFaDate(createdAt) : "",
    amount: Number(row.amount_toman) || 0,
    status,
    type: "deposit",
    paymentMethod: "card",
    transferDirection: null,
    orderId: String(row.id),
    createdAt,
    verifiedAt: status === "success" ? reviewedAt : null,
    cardNumber: row.card_number ? String(row.card_number) : null,
    adminNote: row.admin_note ?? null,
  };
}

function mapTransferRow(row, viewerTelegramId) {
  const createdAt = row.created_at ? new Date(row.created_at).toISOString() : null;
  const isOut = Number(row.from_telegram_id) === Number(viewerTelegramId);
  const peerName =
    row.peer_full_name || row.peer_telegram_name || row.peer_user_name || "کاربر";

  return {
    ...emptyTxBase(),
    id: `transfer-${row.id}`,
    title: isOut ? `انتقال به ${peerName}` : `دریافت از ${peerName}`,
    date: createdAt ? formatFaDate(createdAt) : "",
    amount: isOut ? -Number(row.amount_toman) : Number(row.amount_toman),
    status: "success",
    type: "transfer",
    paymentMethod: "wallet",
    transferDirection: isOut ? "out" : "in",
    orderId: row.transfer_code,
    createdAt,
    verifiedAt: createdAt,
    recipientUsername: row.peer_user_name ?? null,
    recipientName: peerName,
    counterpartyTelegramId: Number(row.counterparty_id),
  };
}

async function loadVersion(telegramUserId) {
  const existing = await redis.get(VER_KEY(telegramUserId));
  if (existing) return existing;
  const version = String(Date.now());
  await redis.set(VER_KEY(telegramUserId), version);
  return version;
}

export async function invalidateWalletTransactionsCache(telegramUserId) {
  const version = String(Date.now());
  await redis
    .multi()
    .set(VER_KEY(telegramUserId), version)
    .del(DATA_KEY(telegramUserId))
    .exec();
  log.event("cache", `wallet txs invalidate tg:${telegramUserId} ver:${version}`);
  return version;
}

async function buildWalletTransactionsPayload(telegramUserId) {
  const sql = getSql();
  const version = await loadVersion(telegramUserId);
  const userId = Number(telegramUserId);

  const [chargeRows, transferRows] = await Promise.all([
    sql`
      SELECT c.*,
        card.card_number
      FROM card_charge_requests c
      LEFT JOIN admin_bank_cards card ON card.id = c.bank_card_id
      WHERE c.telegram_user_id = ${userId}
      ORDER BY c.created_at DESC
      LIMIT 100
    `,
    sql`
      SELECT t.*,
        CASE
          WHEN t.from_telegram_id = ${userId} THEN t.to_telegram_id
          ELSE t.from_telegram_id
        END AS counterparty_id,
        peer.user_name AS peer_user_name,
        peer.user_telegram_name AS peer_telegram_name,
        peer.user_full_name AS peer_full_name
      FROM wallet_transfers t
      JOIN users peer ON peer.user_id = CASE
        WHEN t.from_telegram_id = ${userId} THEN t.to_telegram_id
        ELSE t.from_telegram_id
      END
      WHERE t.from_telegram_id = ${userId} OR t.to_telegram_id = ${userId}
      ORDER BY t.created_at DESC
      LIMIT 100
    `,
  ]);

  const items = [
    ...chargeRows.map(mapCardChargeRow),
    ...transferRows.map((row) => mapTransferRow(row, userId)),
  ].sort((a, b) => {
    const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
    const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
    return bTime - aTime;
  });

  return {
    version,
    cachedAt: new Date().toISOString(),
    items: items.slice(0, 100),
  };
}

export async function getWalletTransactions(telegramUserId) {
  const cached = await redis.get(DATA_KEY(telegramUserId));
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      await redis.del(DATA_KEY(telegramUserId));
    }
  }

  const payload = await buildWalletTransactionsPayload(telegramUserId);
  await redis.set(
    DATA_KEY(telegramUserId),
    JSON.stringify(payload),
    "EX",
    CACHE_TTL_SECONDS,
  );
  return payload;
}

export async function syncWalletTransactions(telegramUserId, clientVersion) {
  const currentVersion = await loadVersion(telegramUserId);
  if (clientVersion && String(clientVersion) === String(currentVersion)) {
    return { changed: false, version: currentVersion };
  }

  const payload = await getWalletTransactions(telegramUserId);
  log.event(
    "cache",
    `wallet txs sync changed tg:${telegramUserId} count:${payload.items.length}`,
  );
  return { changed: true, ...payload };
}
