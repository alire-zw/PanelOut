import { getSql } from "./postgres.js";
import { getTehranRangeStart } from "../lib/tehranTime.js";

export async function ensurePanelUsageChargesTable() {
  const sql = getSql();
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS panel_usage_charges (
      id                   BIGSERIAL PRIMARY KEY,
      subscription_id      BIGINT NOT NULL REFERENCES user_panel_subscriptions(id) ON DELETE CASCADE,
      user_row_id          BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      telegram_user_id     BIGINT NOT NULL,
      traffic_bytes        BIGINT NOT NULL,
      amount_irt           BIGINT NOT NULL,
      traffic_after_bytes  BIGINT NOT NULL,
      wallet_source        TEXT NOT NULL DEFAULT 'main',
      date_created         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT panel_usage_charges_wallet_check CHECK (
        wallet_source IN ('main', 'panel')
      )
    )
  `);

  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS panel_usage_charges_sub_idx
    ON panel_usage_charges (subscription_id)
  `);

  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS panel_usage_charges_user_idx
    ON panel_usage_charges (user_row_id, date_created DESC)
  `);
}

export async function createPanelUsageCharge(txOrSql, input) {
  const sql = txOrSql;
  const [row] = await sql`
    INSERT INTO panel_usage_charges (
      subscription_id, user_row_id, telegram_user_id,
      traffic_bytes, amount_irt, traffic_after_bytes, wallet_source
    ) VALUES (
      ${input.subscriptionId},
      ${input.userRowId},
      ${input.telegramUserId},
      ${String(input.trafficBytes)},
      ${String(input.amountIrt)},
      ${String(input.trafficAfterBytes)},
      ${input.walletSource || "main"}
    )
    RETURNING *
  `;
  return row;
}

export async function listPanelUsageChargesForUser(telegramUserId, limit = 100) {
  const sql = getSql();
  return sql`
    SELECT
      c.*,
      s.client_username,
      s.service_type
    FROM panel_usage_charges c
    JOIN user_panel_subscriptions s ON s.id = c.subscription_id
    WHERE c.telegram_user_id = ${Number(telegramUserId)}
    ORDER BY c.date_created DESC, c.id DESC
    LIMIT ${limit}
  `;
}

function invoiceUserLabel(row) {
  if (row.user_full_name?.trim()) return row.user_full_name.trim();
  if (row.user_telegram_name?.trim()) return row.user_telegram_name.trim();
  if (row.user_name?.trim()) return `@${row.user_name.trim()}`;
  return `کاربر ${row.telegram_user_id}`;
}

function mapInvoiceRow(row) {
  return {
    id: Number(row.id),
    subscriptionId: Number(row.subscription_id),
    telegramUserId: Number(row.telegram_user_id),
    clientUsername: row.client_username,
    serviceType: row.service_type,
    trafficBytes: String(row.traffic_bytes),
    amountIrt: Number(row.amount_irt),
    trafficAfterBytes: String(row.traffic_after_bytes),
    walletSource: row.wallet_source,
    createdAt: row.date_created
      ? new Date(row.date_created).toISOString()
      : null,
    userDisplayName: invoiceUserLabel(row),
    username: row.user_name ?? null,
  };
}

export async function getAdminUsageInvoices({ range = "week", limit = 50, offset = 0 } = {}) {
  const sql = getSql();
  const since = getTehranRangeStart(range);
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  const timeFilter = since
    ? sql`AND c.date_created >= ${since}`
    : sql``;

  const [
    summaryRows,
    byServiceRows,
    topUserRows,
    topPanelRows,
    itemRows,
    totalRows,
  ] = await Promise.all([
    sql`
      SELECT
        COUNT(*)::int AS invoice_count,
        COUNT(DISTINCT c.telegram_user_id)::int AS users_count,
        COALESCE(SUM(c.amount_irt), 0)::bigint AS amount_irt,
        COALESCE(SUM(c.traffic_bytes), 0)::bigint AS traffic_bytes
      FROM panel_usage_charges c
      WHERE TRUE ${timeFilter}
    `,
    sql`
      SELECT
        s.service_type,
        COUNT(*)::int AS invoice_count,
        COALESCE(SUM(c.amount_irt), 0)::bigint AS amount_irt,
        COALESCE(SUM(c.traffic_bytes), 0)::bigint AS traffic_bytes
      FROM panel_usage_charges c
      JOIN user_panel_subscriptions s ON s.id = c.subscription_id
      WHERE TRUE ${timeFilter}
      GROUP BY s.service_type
      ORDER BY amount_irt DESC, invoice_count DESC
    `,
    sql`
      SELECT
        c.telegram_user_id,
        u.user_full_name,
        u.user_telegram_name,
        u.user_name,
        COUNT(*)::int AS invoice_count,
        COALESCE(SUM(c.amount_irt), 0)::bigint AS amount_irt,
        COALESCE(SUM(c.traffic_bytes), 0)::bigint AS traffic_bytes
      FROM panel_usage_charges c
      JOIN users u ON u.id = c.user_row_id
      WHERE TRUE ${timeFilter}
      GROUP BY c.telegram_user_id, u.user_full_name, u.user_telegram_name, u.user_name
      ORDER BY amount_irt DESC, invoice_count DESC
      LIMIT 8
    `,
    sql`
      SELECT
        s.client_username,
        s.service_type,
        c.telegram_user_id,
        u.user_full_name,
        u.user_telegram_name,
        u.user_name,
        COUNT(*)::int AS invoice_count,
        COALESCE(SUM(c.amount_irt), 0)::bigint AS amount_irt,
        COALESCE(SUM(c.traffic_bytes), 0)::bigint AS traffic_bytes
      FROM panel_usage_charges c
      JOIN user_panel_subscriptions s ON s.id = c.subscription_id
      JOIN users u ON u.id = c.user_row_id
      WHERE TRUE ${timeFilter}
      GROUP BY
        s.client_username,
        s.service_type,
        c.telegram_user_id,
        u.user_full_name,
        u.user_telegram_name,
        u.user_name
      ORDER BY amount_irt DESC, invoice_count DESC
      LIMIT 8
    `,
    sql`
      SELECT
        c.*,
        s.client_username,
        s.service_type,
        u.user_full_name,
        u.user_telegram_name,
        u.user_name
      FROM panel_usage_charges c
      JOIN user_panel_subscriptions s ON s.id = c.subscription_id
      JOIN users u ON u.id = c.user_row_id
      WHERE TRUE ${timeFilter}
      ORDER BY c.date_created DESC, c.id DESC
      LIMIT ${safeLimit}
      OFFSET ${safeOffset}
    `,
    sql`
      SELECT COUNT(*)::int AS count
      FROM panel_usage_charges c
      WHERE TRUE ${timeFilter}
    `,
  ]);

  const summary = summaryRows[0] ?? {};

  return {
    range,
    summary: {
      invoiceCount: Number(summary.invoice_count ?? 0),
      usersCount: Number(summary.users_count ?? 0),
      amountIrt: Number(summary.amount_irt ?? 0),
      trafficBytes: String(summary.traffic_bytes ?? 0),
    },
    byServiceType: byServiceRows.map((row) => ({
      serviceType: row.service_type,
      invoiceCount: Number(row.invoice_count ?? 0),
      amountIrt: Number(row.amount_irt ?? 0),
      trafficBytes: String(row.traffic_bytes ?? 0),
    })),
    topUsers: topUserRows.map((row) => ({
      telegramUserId: Number(row.telegram_user_id),
      displayName: invoiceUserLabel(row),
      username: row.user_name ?? null,
      invoiceCount: Number(row.invoice_count ?? 0),
      amountIrt: Number(row.amount_irt ?? 0),
      trafficBytes: String(row.traffic_bytes ?? 0),
    })),
    topPanels: topPanelRows.map((row) => ({
      clientUsername: row.client_username,
      serviceType: row.service_type,
      telegramUserId: Number(row.telegram_user_id),
      ownerDisplayName: invoiceUserLabel(row),
      invoiceCount: Number(row.invoice_count ?? 0),
      amountIrt: Number(row.amount_irt ?? 0),
      trafficBytes: String(row.traffic_bytes ?? 0),
    })),
    items: itemRows.map(mapInvoiceRow),
    pagination: {
      limit: safeLimit,
      offset: safeOffset,
      total: Number(totalRows[0]?.count ?? 0),
      hasMore: safeOffset + itemRows.length < Number(totalRows[0]?.count ?? 0),
    },
  };
}
