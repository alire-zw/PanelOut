import { getSql } from "../db/postgres.js";

const INSERT_BATCH_SIZE = 100;

function quoteIdent(name) {
  return `"${String(name).replaceAll('"', '""')}"`;
}

function escapeSqlLiteral(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") return String(value);
  if (typeof value === "bigint") return String(value);
  if (value instanceof Date) return `'${value.toISOString().replace(/'/g, "''")}'`;
  if (Buffer.isBuffer(value)) return `'\\x${value.toString("hex")}'`;
  if (Array.isArray(value)) {
    const items = value.map((item) => escapeSqlLiteral(item)).join(", ");
    return `ARRAY[${items}]`;
  }
  if (typeof value === "object") {
    return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function listPublicTables(sql) {
  const rows = await sql`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `;
  return rows.map((row) => row.tablename);
}

async function getTableColumns(sql, tableName) {
  const rows = await sql`
    SELECT
      a.attname AS column_name,
      pg_catalog.format_type(a.atttypid, a.atttypmod) AS column_type,
      a.attnotnull AS not_null,
      pg_get_expr(ad.adbin, ad.adrelid) AS default_expr
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    LEFT JOIN pg_attrdef ad ON ad.adrelid = c.oid AND ad.adnum = a.attnum
    WHERE n.nspname = 'public'
      AND c.relname = ${tableName}
      AND c.relkind = 'r'
      AND a.attnum > 0
      AND NOT a.attisdropped
    ORDER BY a.attnum
  `;

  return rows.map((row) => ({
    name: row.column_name,
    type: row.column_type,
    notNull: row.not_null,
    defaultExpr: row.default_expr,
  }));
}

function buildCreateTableSql(tableName, columns) {
  const body = columns
    .map((column) => {
      let line = `${quoteIdent(column.name)} ${column.type}`;
      if (column.notNull) line += " NOT NULL";
      if (column.defaultExpr) line += ` DEFAULT ${column.defaultExpr}`;
      return line;
    })
    .join(",\n  ");

  return `CREATE TABLE IF NOT EXISTS ${quoteIdent(tableName)} (\n  ${body}\n);`;
}

async function dumpTableInserts(sql, tableName, columns) {
  const colNames = columns.map((column) => column.name);
  if (colNames.length === 0) return "";

  const quotedCols = colNames.map(quoteIdent).join(", ");
  const rows = await sql.unsafe(`SELECT * FROM ${quoteIdent(tableName)}`);
  if (rows.length === 0) return "";

  const lines = [];
  for (let index = 0; index < rows.length; index += INSERT_BATCH_SIZE) {
    const batch = rows.slice(index, index + INSERT_BATCH_SIZE);
    const values = batch
      .map((row) => {
        const rowValues = colNames.map((col) => escapeSqlLiteral(row[col]));
        return `(${rowValues.join(", ")})`;
      })
      .join(",\n  ");

    lines.push(
      `INSERT INTO ${quoteIdent(tableName)} (${quotedCols}) VALUES\n  ${values};`,
    );
  }

  return `${lines.join("\n\n")}\n`;
}

async function dumpSequenceResets(sql, tableName, columns) {
  const lines = [];
  for (const column of columns) {
    if (!/^(?:bigint|integer|smallint)/i.test(column.type)) continue;
    if (!column.defaultExpr || !/nextval/i.test(column.defaultExpr)) continue;

    const [row] = await sql`
      SELECT pg_get_serial_sequence(${`public.${tableName}`}, ${column.name}) AS seq_name
    `;
    if (!row?.seq_name) continue;

    lines.push(
      `SELECT setval('${row.seq_name}', COALESCE((SELECT MAX(${quoteIdent(column.name)}) FROM ${quoteIdent(tableName)}), 1), (SELECT COUNT(*) > 0 FROM ${quoteIdent(tableName)}));`,
    );
  }
  return lines.join("\n");
}

export async function dumpDatabaseViaNode() {
  const sql = getSql();
  const tables = await listPublicTables(sql);
  const generatedAt = new Date().toISOString();
  const parts = [
    "-- PanelOut database backup",
    "-- Exporter: node (postgres connection)",
    `-- Generated at: ${generatedAt}`,
    "",
    "BEGIN;",
    "SET session_replication_role = replica;",
    "",
  ];

  const tableMeta = [];
  for (const tableName of tables) {
    const columns = await getTableColumns(sql, tableName);
    tableMeta.push({ tableName, columns });
    parts.push(buildCreateTableSql(tableName, columns));
    parts.push("");
  }

  if (tables.length > 0) {
    const quotedTables = tables.map(quoteIdent).join(", ");
    parts.push(`TRUNCATE ${quotedTables} RESTART IDENTITY CASCADE;`);
    parts.push("");
  }

  for (const { tableName, columns } of tableMeta) {
    const inserts = await dumpTableInserts(sql, tableName, columns);
    if (inserts) {
      parts.push(`-- Data: ${tableName}`);
      parts.push(inserts);
    }
  }

  parts.push("-- Sequences");
  for (const { tableName, columns } of tableMeta) {
    const resets = await dumpSequenceResets(sql, tableName, columns);
    if (resets) parts.push(resets);
  }

  parts.push("");
  parts.push("SET session_replication_role = DEFAULT;");
  parts.push("COMMIT;");
  parts.push("");

  return Buffer.from(parts.join("\n"), "utf8");
}
