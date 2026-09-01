import { getSql } from "./postgres.js";
import { redis } from "./redis.js";
import { log } from "../lib/logger.js";
import { listPanelUsageChargesForUser } from "./panelUsageCharges.js";
import {
  listOutboundUsageChargesForUser,
  listOutboundVolumePurchasesForUser,
} from "./outboundUsageCharges.js";
import { formatTrafficGb } from "../lib/usageBillingMath.js";

const DATA_KEY = (userId) => `wallet:txs:data:${userId}`;
const VER_KEY = (userId) => `wallet:txs:ver:${userId}`;
const CACHE_TTL_SECONDS = 60 * 10;
const USAGE_INVOICE_BATCH_SIZE = 20;
const PANEL_USAGE_FETCH_LIMIT = 1000;

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
    subtitle: null,
    panelUsername: null,
    panelServiceType: null,
    trafficBytes: null,
    trafficGb: null,
    walletSource: null,
    chargeCount: null,
    invoiceNumber: null,
    anchorChargeId: null,
    dateFrom: null,
    dateTo: null,
  };
}

function mapTronTransactionRow(row) {
  const createdAt = row.date_created ? new Date(row.date_created).toISOString() : null;
  const verifiedAt = row.block_timestamp
    ? new Date(row.block_timestamp).toISOString()
    : createdAt;

  return {
    ...emptyTxBase(),
    id: `tron-${row.id}`,
    title: "شارژ ترون",
    date: verifiedAt ? formatFaDate(verifiedAt) : "",
    amount: Number(row.amount_irt) || 0,
    status: "success",
    type: "deposit",
    paymentMethod: "tron",
    transferDirection: null,
    orderId: String(row.id),
    createdAt,
    verifiedAt,
    amountTrx: row.amount_trx ? String(row.amount_trx) : null,
    incomingTxHash: row.tx_hash ? String(row.tx_hash) : null,
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

function sumBigInt(rows, field) {
  return rows.reduce((total, row) => total + BigInt(row[field] ?? 0), 0n);
}

function sortChargesAsc(a, b) {
  const aTime = new Date(a.date_created).getTime();
  const bTime = new Date(b.date_created).getTime();
  if (aTime !== bTime) return aTime - bTime;
  return Number(a.id) - Number(b.id);
}

function panelUsageBatchTitle(username, serviceType) {
  if (serviceType === "panel_reseller") {
    return `مصرف پنل ریسلری · ${username || "—"}`;
  }
  return `مصرف پنل · ${username || "—"}`;
}

function mapPanelUsageInvoiceBatch(charges, batchIndex) {
  const amountIrt = sumBigInt(charges, "amount_irt");
  const trafficBytes = sumBigInt(charges, "traffic_bytes");
  const trafficGb = formatTrafficGb(trafficBytes);
  const chargeCount = charges.length;
  const first = charges[0];
  const last = charges[charges.length - 1];
  const anchorChargeId = String(first.id);
  const invoiceNumber = batchIndex + 1;
  const dateFromIso = first.date_created
    ? new Date(first.date_created).toISOString()
    : null;
  const dateToIso = last.date_created
    ? new Date(last.date_created).toISOString()
    : null;
  const createdAt = dateToIso;
  const walletSource = first.wallet_source === "panel" ? "panel" : "main";
  const username = first.client_username ?? null;
  const serviceType = first.service_type ?? null;

  return {
    ...emptyTxBase(),
    id: `panel-invoice-${first.subscription_id}-${anchorChargeId}`,
    title: panelUsageBatchTitle(username, serviceType),
    subtitle: `${trafficGb} گیگ · ${chargeCount} دوره`,
    date: createdAt ? formatFaDate(createdAt) : "",
    amount: -Number(amountIrt),
    status: "success",
    type: "panel_usage",
    paymentMethod: walletSource === "panel" ? "panel_wallet" : "wallet",
    transferDirection: null,
    orderId: `#${String(invoiceNumber).padStart(3, "0")}`,
    createdAt,
    verifiedAt: createdAt,
    panelUsername: username,
    panelServiceType: serviceType,
    trafficBytes: String(trafficBytes),
    trafficGb,
    walletSource,
    chargeCount,
    invoiceNumber,
    anchorChargeId,
    dateFrom: dateFromIso,
    dateTo: dateToIso,
  };
}

function outboundUsageBatchTitle(username) {
  return `مصرف اوتباند · ${username || "—"}`;
}

function mapOutboundUsageInvoiceBatch(charges, batchIndex) {
  const amountIrt = sumBigInt(charges, "amount_irt");
  const trafficBytes = sumBigInt(charges, "traffic_bytes");
  const trafficGb = formatTrafficGb(trafficBytes);
  const chargeCount = charges.length;
  const first = charges[0];
  const last = charges[charges.length - 1];
  const anchorChargeId = String(first.id);
  const invoiceNumber = batchIndex + 1;
  const dateFromIso = first.date_created
    ? new Date(first.date_created).toISOString()
    : null;
  const dateToIso = last.date_created
    ? new Date(last.date_created).toISOString()
    : null;
  const createdAt = dateToIso;
  const username = first.client_username ?? null;
  const serviceType = first.service_type ?? null;

  return {
    ...emptyTxBase(),
    id: `outbound-invoice-${first.subscription_id}-${anchorChargeId}`,
    title: outboundUsageBatchTitle(username),
    subtitle: `${trafficGb} گیگ · ${chargeCount} دوره`,
    date: createdAt ? formatFaDate(createdAt) : "",
    amount: -Number(amountIrt),
    status: "success",
    type: "outbound_usage",
    paymentMethod: "wallet",
    transferDirection: null,
    orderId: `#${String(invoiceNumber).padStart(3, "0")}`,
    createdAt,
    verifiedAt: createdAt,
    panelUsername: username,
    panelServiceType: serviceType,
    trafficBytes: String(trafficBytes),
    trafficGb,
    walletSource: "main",
    chargeCount,
    invoiceNumber,
    anchorChargeId,
    dateFrom: dateFromIso,
    dateTo: dateToIso,
  };
}

function aggregateOutboundUsageCharges(chargeRows) {
  if (!chargeRows.length) return [];

  const bySubscription = new Map();
  for (const row of chargeRows) {
    const key = String(row.subscription_id);
    if (!bySubscription.has(key)) bySubscription.set(key, []);
    bySubscription.get(key).push(row);
  }

  const invoices = [];
  for (const group of bySubscription.values()) {
    const sorted = [...group].sort(sortChargesAsc);
    for (let i = 0; i < sorted.length; i += USAGE_INVOICE_BATCH_SIZE) {
      const slice = sorted.slice(i, i + USAGE_INVOICE_BATCH_SIZE);
      const batchIndex = Math.floor(i / USAGE_INVOICE_BATCH_SIZE);
      invoices.push(mapOutboundUsageInvoiceBatch(slice, batchIndex));
    }
  }

  return invoices.sort((a, b) => {
    const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
    const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
    return bTime - aTime;
  });
}

function mapOutboundVolumePurchaseRow(row) {
  const createdAt = row.created_at ? new Date(row.created_at).toISOString() : null;
  const volumeGb = Number(row.volume_gb) || 0;
  return {
    ...emptyTxBase(),
    id: `outbound-volume-${row.id}`,
    title: `خرید اوتباند حجمی · ${row.client_username || "—"}`,
    subtitle: `${volumeGb.toLocaleString("en-US")} گیگ`,
    date: createdAt ? formatFaDate(createdAt) : "",
    amount: -Number(row.purchase_amount_irt || 0),
    status: "success",
    type: "outbound_volume_purchase",
    paymentMethod: "wallet",
    transferDirection: null,
    orderId: String(row.id),
    createdAt,
    verifiedAt: createdAt,
    panelUsername: row.client_username ?? null,
    panelServiceType: row.service_type ?? null,
    quantity: volumeGb,
  };
}

/** Batch every 20 charges per panel (subscription), never mix panels. */
function aggregatePanelUsageCharges(chargeRows) {
  if (!chargeRows.length) return [];

  const bySubscription = new Map();
  for (const row of chargeRows) {
    const key = String(row.subscription_id);
    if (!bySubscription.has(key)) bySubscription.set(key, []);
    bySubscription.get(key).push(row);
  }

  const invoices = [];
  for (const group of bySubscription.values()) {
    const sorted = [...group].sort(sortChargesAsc);
    for (let i = 0; i < sorted.length; i += USAGE_INVOICE_BATCH_SIZE) {
      const slice = sorted.slice(i, i + USAGE_INVOICE_BATCH_SIZE);
      const batchIndex = Math.floor(i / USAGE_INVOICE_BATCH_SIZE);
      invoices.push(mapPanelUsageInvoiceBatch(slice, batchIndex));
    }
  }

  return invoices.sort((a, b) => {
    const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
    const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
    return bTime - aTime;
  });
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
  void import("./userPanelsCache.js")
    .then(({ invalidateUserPanelsCache }) => invalidateUserPanelsCache(telegramUserId))
    .catch(() => {});
  return version;
}

export async function buildWalletTransactionsPayload(telegramUserId) {
  const sql = getSql();
  const version = await loadVersion(telegramUserId);
  const userId = Number(telegramUserId);

  const [chargeRows, transferRows, tronRows, panelUsageRows, outboundUsageRows, outboundVolumeRows] =
    await Promise.all([
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
    sql`
      SELECT *
      FROM tron_transactions
      WHERE telegram_user_id = ${userId}
      ORDER BY date_created DESC
      LIMIT 100
    `,
    listPanelUsageChargesForUser(userId, PANEL_USAGE_FETCH_LIMIT),
    listOutboundUsageChargesForUser(userId, PANEL_USAGE_FETCH_LIMIT),
    listOutboundVolumePurchasesForUser(userId, 50),
  ]);

  const panelUsageItems = aggregatePanelUsageCharges(panelUsageRows);
  const outboundUsageItems = aggregateOutboundUsageCharges(outboundUsageRows);
  const outboundVolumeItems = outboundVolumeRows.map(mapOutboundVolumePurchaseRow);

  const items = [
    ...chargeRows.map(mapCardChargeRow),
    ...transferRows.map((row) => mapTransferRow(row, userId)),
    ...tronRows.map(mapTronTransactionRow),
    ...panelUsageItems,
    ...outboundUsageItems,
    ...outboundVolumeItems,
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
