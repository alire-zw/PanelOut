/**
 * One-time: renumber sparse primary keys to 1..N and retarget FKs,
 * then reset all id sequences so future inserts stay contiguous.
 *
 * Usage: node scripts/renumber-ids.mjs
 */
import "dotenv/config";
import { initPostgres, getSql, closePostgres } from "../src/db/postgres.js";

const OFFSET = 1_000_000_000n;

function toBig(value) {
  return BigInt(value);
}

async function remappingTable(sql, {
  table,
  orderBy,
  children = [],
  auditTargetType = null,
}) {
  const rows = await sql.unsafe(`
    SELECT id
    FROM ${table}
    ORDER BY ${orderBy}
  `);

  if (rows.length === 0) {
    return { table, count: 0, map: [] };
  }

  const map = rows.map((row, index) => ({
    oldId: toBig(row.id),
    newId: BigInt(index + 1),
  }));

  const alreadySequential = map.every((entry) => entry.oldId === entry.newId);
  if (alreadySequential) {
    return { table, count: map.length, map, skipped: true };
  }

  // Phase 1: shift to high temporary IDs to avoid PK collisions.
  await sql.unsafe(`UPDATE ${table} SET id = id + ${OFFSET}`);
  for (const child of children) {
    await sql.unsafe(`
      UPDATE ${child.table}
      SET ${child.column} = ${child.column} + ${OFFSET}
      WHERE ${child.column} IS NOT NULL
    `);
  }
  if (auditTargetType) {
    for (const entry of map) {
      await sql`
        UPDATE admin_audit_logs
        SET target_id = ${(entry.oldId + OFFSET).toString()}
        WHERE target_type = ${auditTargetType}
          AND target_id = ${entry.oldId.toString()}
      `;
    }
  }

  // Phase 2: apply final compact ids.
  for (const entry of map) {
    const tempId = entry.oldId + OFFSET;
    await sql.unsafe(
      `UPDATE ${table} SET id = ${entry.newId} WHERE id = ${tempId}`,
    );

    for (const child of children) {
      await sql.unsafe(`
        UPDATE ${child.table}
        SET ${child.column} = ${entry.newId}
        WHERE ${child.column} = ${tempId}
      `);
    }

    if (auditTargetType) {
      await sql`
        UPDATE admin_audit_logs
        SET target_id = ${entry.newId.toString()}
        WHERE target_type = ${auditTargetType}
          AND target_id = ${tempId.toString()}
      `;
    }
  }

  return { table, count: map.length, map, skipped: false };
}

async function resetAllSequences(sql) {
  const sequences = await sql`
    SELECT
      s.relname AS sequencename,
      t.relname AS table_name,
      a.attname AS column_name
    FROM pg_class s
    JOIN pg_namespace n ON n.oid = s.relnamespace
    JOIN pg_depend d ON d.objid = s.oid AND d.classid = 'pg_class'::regclass AND d.deptype = 'a'
    JOIN pg_class t ON t.oid = d.refobjid
    JOIN pg_attribute a
      ON a.attrelid = t.oid
     AND a.attnum = d.refobjsubid
     AND NOT a.attisdropped
    WHERE n.nspname = 'public'
      AND s.relkind = 'S'
    ORDER BY s.relname
  `;

  const results = [];
  for (const seq of sequences) {
    const [row] = await sql.unsafe(`
      SELECT COALESCE(MAX(${quoteIdent(seq.column_name)}), 0)::bigint AS max_id
      FROM ${quoteIdent(seq.table_name)}
    `);
    const maxId = Number(row.max_id || 0);
    if (maxId > 0) {
      await sql.unsafe(`SELECT setval('${seq.sequencename}', ${maxId}, true)`);
    } else {
      await sql.unsafe(`SELECT setval('${seq.sequencename}', 1, false)`);
    }
    results.push({ sequence: seq.sequencename, maxId, next: maxId > 0 ? maxId + 1 : 1 });
  }
  return results;
}

function quoteIdent(name) {
  return `"${String(name).replaceAll('"', '""')}"`;
}

async function verify(sql) {
  const checks = [];
  for (const table of [
    "users",
    "user_panel_subscriptions",
    "admin_bank_cards",
    "panel_usage_charges",
    "card_charge_requests",
  ]) {
    const [row] = await sql.unsafe(`
      SELECT COUNT(*)::int AS c, COALESCE(MAX(id), 0)::bigint AS max_id
      FROM ${quoteIdent(table)}
    `);
    checks.push({
      table,
      count: row.c,
      maxId: String(row.max_id),
      sequential: Number(row.max_id) === row.c || row.c === 0,
    });
  }

  const brokenUserFk = await sql`
    SELECT count(*)::int AS c
    FROM user_panel_subscriptions s
    LEFT JOIN users u ON u.id = s.user_row_id
    WHERE u.id IS NULL
  `;
  const brokenChargeUser = await sql`
    SELECT count(*)::int AS c
    FROM panel_usage_charges c
    LEFT JOIN users u ON u.id = c.user_row_id
    WHERE u.id IS NULL
  `;
  const brokenChargeSub = await sql`
    SELECT count(*)::int AS c
    FROM panel_usage_charges c
    LEFT JOIN user_panel_subscriptions s ON s.id = c.subscription_id
    WHERE s.id IS NULL
  `;
  const brokenCardFk = await sql`
    SELECT count(*)::int AS c
    FROM card_charge_requests r
    LEFT JOIN admin_bank_cards b ON b.id = r.bank_card_id
    WHERE r.bank_card_id IS NOT NULL AND b.id IS NULL
  `;

  return {
    checks,
    brokenFks: {
      subscriptions_user: brokenUserFk[0].c,
      charges_user: brokenChargeUser[0].c,
      charges_sub: brokenChargeSub[0].c,
      charges_card: brokenCardFk[0].c,
    },
    users: await sql`SELECT id, user_id, user_name FROM users ORDER BY id`,
    subscriptions: await sql`
      SELECT id, user_row_id, client_username, service_type
      FROM user_panel_subscriptions
      ORDER BY id
    `,
    bankCards: await sql`SELECT id, card_number, holder_name FROM admin_bank_cards ORDER BY id`,
  };
}

await initPostgres();
const sql = getSql();

try {
  await sql.begin(async (tx) => {
    await tx`SELECT set_config('session_replication_role', 'replica', true)`;

    const usersResult = await remappingTable(tx, {
      table: "users",
      orderBy: "date_created ASC NULLS LAST, id ASC",
      children: [
        { table: "user_panel_subscriptions", column: "user_row_id" },
        { table: "panel_usage_charges", column: "user_row_id" },
        { table: "outbound_usage_charges", column: "user_row_id" },
        { table: "support_tickets", column: "user_id" },
      ],
    });

    const subsResult = await remappingTable(tx, {
      table: "user_panel_subscriptions",
      orderBy: "created_at ASC NULLS LAST, id ASC",
      children: [
        { table: "panel_usage_charges", column: "subscription_id" },
        { table: "outbound_usage_charges", column: "subscription_id" },
      ],
      auditTargetType: "user_panel",
    });

    const cardsResult = await remappingTable(tx, {
      table: "admin_bank_cards",
      orderBy: "created_at ASC NULLS LAST, id ASC",
      children: [{ table: "card_charge_requests", column: "bank_card_id" }],
      auditTargetType: "bank_card",
    });

    const sequences = await resetAllSequences(tx);

    await tx`SELECT set_config('session_replication_role', 'origin', true)`;

    const verification = await verify(tx);

    if (Object.values(verification.brokenFks).some((count) => count > 0)) {
      throw new Error(`FK integrity failed: ${JSON.stringify(verification.brokenFks)}`);
    }
    if (verification.checks.some((row) => !row.sequential)) {
      throw new Error(`Non-sequential after remap: ${JSON.stringify(verification.checks)}`);
    }

    const serializeMap = (result) => ({
      table: result.table,
      count: result.count,
      skipped: Boolean(result.skipped),
      map: (result.map || []).map((m) => ({
        oldId: m.oldId.toString(),
        newId: m.newId.toString(),
      })),
    });

    console.log(
      JSON.stringify(
        {
          ok: true,
          remapped: {
            users: serializeMap(usersResult),
            subscriptions: serializeMap(subsResult),
            bankCards: serializeMap(cardsResult),
          },
          sequences,
          verification,
        },
        null,
        2,
      ),
    );
  });
} finally {
  await closePostgres();
}
