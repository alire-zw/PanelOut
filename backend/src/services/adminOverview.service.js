import { getSql } from "../db/postgres.js";
import { countUsers } from "../db/users.js";
import { countOpenSupportTickets } from "../db/supportTickets.js";
import { getTehranDayStart } from "../lib/tehranTime.js";

export async function getAdminOverview() {
  const sql = getSql();
  const dayStart = getTehranDayStart();

  const [
    usersTotal,
    pendingCharges,
    activeCards,
    openTickets,
    usageToday,
    cardChargesToday,
    tronChargesToday,
  ] = await Promise.all([
    countUsers(),
    sql`SELECT COUNT(*)::int AS count FROM card_charge_requests WHERE status = 'pending'`,
    sql`SELECT COUNT(*)::int AS count FROM admin_bank_cards WHERE is_active = TRUE`,
    countOpenSupportTickets(),
    sql`
      SELECT
        COALESCE(SUM(traffic_bytes), 0)::bigint AS traffic_bytes,
        COALESCE(SUM(amount_irt), 0)::bigint AS amount_irt,
        COUNT(DISTINCT telegram_user_id)::int AS users_count,
        COUNT(*)::int AS billing_count
      FROM panel_usage_charges
      WHERE date_created >= ${dayStart}
    `,
    sql`
      SELECT
        COALESCE(SUM(amount_toman), 0)::bigint AS amount_irt,
        COUNT(*)::int AS charge_count,
        COUNT(DISTINCT telegram_user_id)::int AS users_count
      FROM card_charge_requests
      WHERE status = 'approved'
        AND reviewed_at IS NOT NULL
        AND reviewed_at >= ${dayStart}
    `,
    sql`
      SELECT
        COALESCE(SUM(amount_irt), 0)::bigint AS amount_irt,
        COUNT(*)::int AS charge_count,
        COUNT(DISTINCT telegram_user_id)::int AS users_count
      FROM tron_transactions
      WHERE date_created >= ${dayStart}
    `,
  ]);

  const usageRow = usageToday[0] ?? {};
  const cardRow = cardChargesToday[0] ?? {};
  const tronRow = tronChargesToday[0] ?? {};

  const chargesAmountIrt =
    Number(cardRow.amount_irt ?? 0) + Number(tronRow.amount_irt ?? 0);
  const chargesCount =
    Number(cardRow.charge_count ?? 0) + Number(tronRow.charge_count ?? 0);

  const [chargeUsersUnion] = await sql`
    SELECT COUNT(DISTINCT telegram_user_id)::int AS users_count
    FROM (
      SELECT telegram_user_id
      FROM card_charge_requests
      WHERE status = 'approved'
        AND reviewed_at IS NOT NULL
        AND reviewed_at >= ${dayStart}
      UNION
      SELECT telegram_user_id
      FROM tron_transactions
      WHERE date_created >= ${dayStart}
    ) AS charged_users
  `;

  return {
    usersCount: usersTotal,
    pendingCharges: Number(pendingCharges[0]?.count ?? 0),
    activeCards: Number(activeCards[0]?.count ?? 0),
    openTickets,
    today: {
      usageTrafficBytes: String(usageRow.traffic_bytes ?? 0),
      usageAmountIrt: Number(usageRow.amount_irt ?? 0),
      usageUsersCount: Number(usageRow.users_count ?? 0),
      usageBillingCount: Number(usageRow.billing_count ?? 0),
      chargesAmountIrt,
      chargesCount,
      chargesUsersCount: Number(chargeUsersUnion?.users_count ?? 0),
      cardChargesAmountIrt: Number(cardRow.amount_irt ?? 0),
      tronChargesAmountIrt: Number(tronRow.amount_irt ?? 0),
    },
  };
}
