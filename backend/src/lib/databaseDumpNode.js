import { getSql } from "../db/postgres.js";

const INSERT_BATCH_SIZE = 100;

function quoteIdent(name) {
  return `"${String(name).replaceAll('"', '""')}"`;
}

function escapeString(value) {
  return String(value).replaceAll("'", "''");
}

function escapeSqlLiteral(value, columnType = "") {
  if (value === null || value === undefined) return "NULL";

  const type = String(columnType || "").toLowerCase();

  if (type === "boolean" || type === "bool") {
    if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
    if (value === "true" || value === 1 || value === "1" || value === "t") return "TRUE";
    if (value === "false" || value === 0 || value === "0" || value === "f") return "FALSE";
    return value ? "TRUE" : "FALSE";
  }

  if (/^(smallint|integer|bigint|numeric|real|double precision|oid|money)/.test(type)) {
    if (typeof value === "bigint") return String(value);
    if (typeof value === "number") {
      if (!Number.isFinite(value)) return "NULL";
      return String(value);
    }
    const raw = String(value).trim();
    if (!raw) return "NULL";
    if (!/^[+-]?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(raw)) {
      return `'${escapeString(raw)}'`;
    }
    return raw;
  }

  if (type === "jsonb" || type === "json") {
    const json =
      typeof value === "string" ? value : JSON.stringify(value, (_, v) =>
        typeof v === "bigint" ? v.toString() : v,
      );
    return `'${escapeString(json)}'::${type}`;
  }

  if (type === "bytea" || Buffer.isBuffer(value)) {
    const buf = Buffer.isBuffer(value) ? value : Buffer.from(String(value));
    return `'\\x${buf.toString("hex")}'::bytea`;
  }

  if (type.endsWith("[]") || Array.isArray(value)) {
    const baseType = type.endsWith("[]") ? type.slice(0, -2) : "text";
    const items = (Array.isArray(value) ? value : []).map((item) =>
      escapeSqlLiteral(item, baseType),
    );
    return `ARRAY[${items.join(", ")}]::${type.endsWith("[]") ? type : `${baseType}[]`}`;
  }

  if (
    value instanceof Date ||
    type.startsWith("timestamp") ||
    type === "date" ||
    type === "time without time zone" ||
    type === "time with time zone"
  ) {
    const raw =
      value instanceof Date
        ? value.toISOString()
        : String(value instanceof Object && value?.toISOString ? value.toISOString() : value);
    return `'${escapeString(raw)}'`;
  }

  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "NULL";
    return String(value);
  }
  if (typeof value === "bigint") return String(value);
  if (typeof value === "object") {
    return `'${escapeString(JSON.stringify(value))}'`;
  }

  return `'${escapeString(value)}'`;
}

async function listPublicTables(sql) {
  const rows = await sql`
    SELECT c.relname AS tablename
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
    ORDER BY c.relname
  `;
  return rows.map((row) => row.tablename);
}

async function listSequences(sql) {
  return sql`
    SELECT
      sequencename,
      data_type,
      start_value,
      min_value,
      max_value,
      increment_by,
      cycle,
      cache_size,
      last_value
    FROM pg_sequences
    WHERE schemaname = 'public'
    ORDER BY sequencename
  `;
}

async function listSequenceOwnership(sql) {
  return sql`
    SELECT
      s.relname AS sequence_name,
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

async function listConstraints(sql) {
  return sql`
    SELECT
      c.relname AS table_name,
      con.conname,
      con.contype,
      pg_get_constraintdef(con.oid, true) AS definition
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND con.contype IN ('p', 'u', 'c', 'f')
    ORDER BY
      CASE con.contype
        WHEN 'p' THEN 1
        WHEN 'u' THEN 2
        WHEN 'c' THEN 3
        WHEN 'f' THEN 4
        ELSE 5
      END,
      c.relname,
      con.conname
  `;
}

async function listStandaloneIndexes(sql) {
  return sql`
    SELECT pg_get_indexdef(i.indexrelid) AS indexdef
    FROM pg_index i
    JOIN pg_class t ON t.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relkind = 'r'
      AND NOT i.indisprimary
      AND NOT i.indisexclusion
      AND NOT EXISTS (
        SELECT 1
        FROM pg_constraint con
        WHERE con.conindid = i.indexrelid
      )
    ORDER BY t.relname, i.indexrelid::regclass::text
  `;
}

function buildCreateSequenceSql(seq) {
  const name = quoteIdent(seq.sequencename);
  const dataType = seq.data_type || "bigint";
  const cycle = seq.cycle ? "CYCLE" : "NO CYCLE";
  return [
    `CREATE SEQUENCE ${name}`,
    `  AS ${dataType}`,
    `  INCREMENT BY ${seq.increment_by}`,
    `  MINVALUE ${seq.min_value}`,
    `  MAXVALUE ${seq.max_value}`,
    `  START WITH ${seq.start_value}`,
    `  CACHE ${seq.cache_size}`,
    `  ${cycle};`,
  ].join("\n");
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

  return `CREATE TABLE ${quoteIdent(tableName)} (\n  ${body}\n);`;
}

async function dumpTableInserts(sql, tableName, columns) {
  const colNames = columns.map((column) => column.name);
  if (colNames.length === 0) return { sqlText: "", rowCount: 0 };

  const quotedCols = colNames.map(quoteIdent).join(", ");
  const rows = await sql.unsafe(`SELECT * FROM ${quoteIdent(tableName)}`);
  if (rows.length === 0) return { sqlText: "", rowCount: 0 };

  const typeByName = Object.fromEntries(columns.map((column) => [column.name, column.type]));
  const lines = [];

  for (let index = 0; index < rows.length; index += INSERT_BATCH_SIZE) {
    const batch = rows.slice(index, index + INSERT_BATCH_SIZE);
    const values = batch
      .map((row) => {
        const rowValues = colNames.map((col) => escapeSqlLiteral(row[col], typeByName[col]));
        return `(${rowValues.join(", ")})`;
      })
      .join(",\n  ");

    lines.push(
      `INSERT INTO ${quoteIdent(tableName)} (${quotedCols}) VALUES\n  ${values};`,
    );
  }

  return { sqlText: `${lines.join("\n\n")}\n`, rowCount: rows.length };
}

function buildSetvalSql(seq) {
  const lastValue = seq.last_value == null ? seq.start_value : seq.last_value;
  const isCalled = seq.last_value != null;
  return `SELECT setval('${escapeString(seq.sequencename)}', ${lastValue}, ${isCalled ? "true" : "false"});`;
}

export async function dumpDatabaseViaNode() {
  const sql = getSql();
  const tables = await listPublicTables(sql);
  const sequences = await listSequences(sql);
  const ownership = await listSequenceOwnership(sql);
  const constraints = await listConstraints(sql);
  const indexes = await listStandaloneIndexes(sql);
  const generatedAt = new Date().toISOString();

  const parts = [
    "-- PanelOut database backup",
    "-- Exporter: node (full schema + data)",
    `-- Generated at: ${generatedAt}`,
    `-- Tables: ${tables.length}`,
    `-- Sequences: ${sequences.length}`,
    "",
    "BEGIN;",
    "SET client_encoding = 'UTF8';",
    "SET session_replication_role = replica;",
    "",
    "-- Drop existing objects for clean restore",
  ];

  for (const tableName of tables) {
    parts.push(`DROP TABLE IF EXISTS ${quoteIdent(tableName)} CASCADE;`);
  }
  for (const seq of sequences) {
    parts.push(`DROP SEQUENCE IF EXISTS ${quoteIdent(seq.sequencename)} CASCADE;`);
  }
  parts.push("");

  parts.push("-- Sequences");
  for (const seq of sequences) {
    parts.push(buildCreateSequenceSql(seq));
    parts.push("");
  }

  const tableMeta = [];
  parts.push("-- Tables");
  for (const tableName of tables) {
    const columns = await getTableColumns(sql, tableName);
    tableMeta.push({ tableName, columns });
    parts.push(buildCreateTableSql(tableName, columns));
    parts.push("");
  }

  if (ownership.length > 0) {
    parts.push("-- Sequence ownership");
    for (const row of ownership) {
      parts.push(
        `ALTER SEQUENCE ${quoteIdent(row.sequence_name)} OWNED BY ${quoteIdent(row.table_name)}.${quoteIdent(row.column_name)};`,
      );
    }
    parts.push("");
  }

  let totalRows = 0;
  parts.push("-- Data");
  for (const { tableName, columns } of tableMeta) {
    const { sqlText, rowCount } = await dumpTableInserts(sql, tableName, columns);
    totalRows += rowCount;
    if (!sqlText) continue;
    parts.push(`-- Data: ${tableName} (${rowCount} rows)`);
    parts.push(sqlText);
  }

  const primaryUniqueCheck = constraints.filter((row) =>
    ["p", "u", "c"].includes(row.contype),
  );
  const foreignKeys = constraints.filter((row) => row.contype === "f");

  if (primaryUniqueCheck.length > 0) {
    parts.push("-- Primary keys, unique constraints, checks");
    for (const row of primaryUniqueCheck) {
      parts.push(
        `ALTER TABLE ONLY ${quoteIdent(row.table_name)} ADD CONSTRAINT ${quoteIdent(row.conname)} ${row.definition};`,
      );
    }
    parts.push("");
  }

  if (indexes.length > 0) {
    parts.push("-- Indexes");
    for (const row of indexes) {
      parts.push(`${row.indexdef};`);
    }
    parts.push("");
  }

  if (foreignKeys.length > 0) {
    parts.push("-- Foreign keys");
    for (const row of foreignKeys) {
      parts.push(
        `ALTER TABLE ONLY ${quoteIdent(row.table_name)} ADD CONSTRAINT ${quoteIdent(row.conname)} ${row.definition};`,
      );
    }
    parts.push("");
  }

  if (sequences.length > 0) {
    parts.push("-- Sequence values");
    for (const seq of sequences) {
      parts.push(buildSetvalSql(seq));
    }
    parts.push("");
  }

  parts.push("SET session_replication_role = DEFAULT;");
  parts.push("COMMIT;");
  parts.push("");
  parts.push(`-- Summary: tables=${tables.length} rows=${totalRows} sequences=${sequences.length} constraints=${constraints.length} indexes=${indexes.length}`);
  parts.push("");

  return Buffer.from(parts.join("\n"), "utf8");
}
