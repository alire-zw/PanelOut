import { getSql } from "../db/postgres.js";
import { getTehranRangeStart } from "../lib/tehranTime.js";

function invoiceUserLabel(row) {
  if (row.user_full_name?.trim()) return row.user_full_name.trim();
  if (row.user_telegram_name?.trim()) return row.user_telegram_name.trim();
  if (row.user_name?.trim()) return `@${row.user_name.trim()}`;
  return `کاربر ${row.telegram_user_id}`;
}

function mapCombinedInvoiceRow(row) {
  return {
    id: Number(row.id),
    source: row.charge_source,
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

function mergeTopUsers(panelRows, outboundRows) {
  const map = new Map();

  for (const row of [...panelRows, ...outboundRows]) {
    const key = String(row.telegramUserId);
    const prev = map.get(key) || {
      telegramUserId: row.telegramUserId,
      displayName: row.displayName,
      username: row.username,
      invoiceCount: 0,
      amountIrt: 0,
      trafficBytes: "0",
    };

    map.set(key, {
      telegramUserId: row.telegramUserId,
      displayName: row.displayName || prev.displayName,
      username: row.username ?? prev.username,
      invoiceCount: prev.invoiceCount + row.invoiceCount,
      amountIrt: prev.amountIrt + row.amountIrt,
      trafficBytes: String(BigInt(prev.trafficBytes) + BigInt(row.trafficBytes)),
    });
  }

  return [...map.values()].sort((a, b) => b.amountIrt - a.amountIrt).slice(0, 8);
}

function mergeByServiceType(panelRows, outboundRows) {
  const map = new Map();
  for (const row of [...panelRows, ...outboundRows]) {
    const key = row.serviceType;
    const prev = map.get(key) || {
      serviceType: key,
      invoiceCount: 0,
      amountIrt: 0,
      trafficBytes: "0",
    };
    map.set(key, {
      serviceType: key,
      invoiceCount: prev.invoiceCount + row.invoiceCount,
      amountIrt: prev.amountIrt + row.amountIrt,
      trafficBytes: String(BigInt(prev.trafficBytes) + BigInt(row.trafficBytes)),
    });
  }
  return [...map.values()].sort((x, y) => y.amountIrt - x.amountIrt);
}

export async function getAdminCombinedUsageInvoices(options = {}) {
  const sql = getSql();
  const range = options.range || "week";
  const since = getTehranRangeStart(range);
  const safeLimit = Math.min(Math.max(Number(options.limit) || 50, 1), 100);
  const safeOffset = Math.max(Number(options.offset) || 0, 0);

  const timeFilter = since ? sql`AND c.date_created >= ${since}` : sql``;

  const [
    summaryRows,
    usersCountRows,
    byServicePanel,
    byServiceOutbound,
    topUserPanel,
    topUserOutbound,
    topPanelPanel,
    topPanelOutbound,
    itemRows,
    totalRows,
  ] = await Promise.all([
    sql`
      SELECT
        COALESCE(SUM(amount_irt), 0)::bigint AS amount_irt,
        COALESCE(SUM(traffic_bytes), 0)::bigint AS traffic_bytes,
        COUNT(*)::int AS invoice_count
      FROM (
        SELECT c.amount_irt, c.traffic_bytes
        FROM panel_usage_charges c
        WHERE TRUE ${timeFilter}
        UNION ALL
        SELECT c.amount_irt, c.traffic_bytes
        FROM outbound_usage_charges c
        WHERE TRUE ${timeFilter}
      ) combined
    `,
    sql`
      SELECT COUNT(*)::int AS users_count
      FROM (
        SELECT c.telegram_user_id FROM panel_usage_charges c WHERE TRUE ${timeFilter}
        UNION
        SELECT c.telegram_user_id FROM outbound_usage_charges c WHERE TRUE ${timeFilter}
      ) u
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
    `,
    sql`
      SELECT
        s.service_type,
        COUNT(*)::int AS invoice_count,
        COALESCE(SUM(c.amount_irt), 0)::bigint AS amount_irt,
        COALESCE(SUM(c.traffic_bytes), 0)::bigint AS traffic_bytes
      FROM outbound_usage_charges c
      JOIN user_panel_subscriptions s ON s.id = c.subscription_id
      WHERE TRUE ${timeFilter}
      GROUP BY s.service_type
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
      FROM outbound_usage_charges c
      JOIN users u ON u.id = c.user_row_id
      WHERE TRUE ${timeFilter}
      GROUP BY c.telegram_user_id, u.user_full_name, u.user_telegram_name, u.user_name
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
      FROM outbound_usage_charges c
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
    `,
    sql`
      SELECT *
      FROM (
        SELECT
          c.id,
          'panel'::text AS charge_source,
          c.subscription_id,
          c.telegram_user_id,
          c.traffic_bytes,
          c.amount_irt,
          c.traffic_after_bytes,
          c.wallet_source,
          c.date_created,
          s.client_username,
          s.service_type,
          u.user_full_name,
          u.user_telegram_name,
          u.user_name
        FROM panel_usage_charges c
        JOIN user_panel_subscriptions s ON s.id = c.subscription_id
        JOIN users u ON u.id = c.user_row_id
        WHERE TRUE ${timeFilter}

        UNION ALL

        SELECT
          c.id,
          'outbound'::text AS charge_source,
          c.subscription_id,
          c.telegram_user_id,
          c.traffic_bytes,
          c.amount_irt,
          c.traffic_after_bytes,
          c.wallet_source,
          c.date_created,
          s.client_username,
          s.service_type,
          u.user_full_name,
          u.user_telegram_name,
          u.user_name
        FROM outbound_usage_charges c
        JOIN user_panel_subscriptions s ON s.id = c.subscription_id
        JOIN users u ON u.id = c.user_row_id
        WHERE TRUE ${timeFilter}
      ) combined
      ORDER BY date_created DESC, id DESC, charge_source DESC
      LIMIT ${safeLimit}
      OFFSET ${safeOffset}
    `,
    sql`
      SELECT COUNT(*)::int AS count
      FROM (
        SELECT c.id FROM panel_usage_charges c WHERE TRUE ${timeFilter}
        UNION ALL
        SELECT c.id FROM outbound_usage_charges c WHERE TRUE ${timeFilter}
      ) combined
    `,
  ]);

  const summary = summaryRows[0] ?? {};
  const total = Number(totalRows[0]?.count ?? 0);

  const mapServiceRow = (row) => ({
    serviceType: row.service_type,
    invoiceCount: Number(row.invoice_count ?? 0),
    amountIrt: Number(row.amount_irt ?? 0),
    trafficBytes: String(row.traffic_bytes ?? 0),
  });

  const mapTopUserRow = (row) => ({
    telegramUserId: Number(row.telegram_user_id),
    displayName: invoiceUserLabel(row),
    username: row.user_name ?? null,
    invoiceCount: Number(row.invoice_count ?? 0),
    amountIrt: Number(row.amount_irt ?? 0),
    trafficBytes: String(row.traffic_bytes ?? 0),
  });

  const mapTopPanelRow = (row) => ({
    clientUsername: row.client_username,
    serviceType: row.service_type,
    telegramUserId: Number(row.telegram_user_id),
    ownerDisplayName: invoiceUserLabel(row),
    invoiceCount: Number(row.invoice_count ?? 0),
    amountIrt: Number(row.amount_irt ?? 0),
    trafficBytes: String(row.traffic_bytes ?? 0),
  });

  const panelTopUsers = topUserPanel.map(mapTopUserRow);
  const outboundTopUsers = topUserOutbound.map(mapTopUserRow);
  const panelTopPanels = topPanelPanel.map(mapTopPanelRow);
  const outboundTopPanels = topPanelOutbound.map(mapTopPanelRow);

  return {
    range,
    summary: {
      invoiceCount: Number(summary.invoice_count ?? 0),
      usersCount: Number(usersCountRows[0]?.users_count ?? 0),
      amountIrt: Number(summary.amount_irt ?? 0),
      trafficBytes: String(summary.traffic_bytes ?? 0),
    },
    byServiceType: mergeByServiceType(
      byServicePanel.map(mapServiceRow),
      byServiceOutbound.map(mapServiceRow),
    ),
    topUsers: mergeTopUsers(panelTopUsers, outboundTopUsers),
    topPanels: [...panelTopPanels, ...outboundTopPanels]
      .sort((a, b) => b.amountIrt - a.amountIrt)
      .slice(0, 8),
    items: itemRows.map(mapCombinedInvoiceRow),
    pagination: {
      limit: safeLimit,
      offset: safeOffset,
      total,
      hasMore: safeOffset + itemRows.length < total,
    },
  };
}
