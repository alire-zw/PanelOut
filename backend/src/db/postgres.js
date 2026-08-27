import postgres from "postgres";
import { config } from "../config.js";
import { log } from "../lib/logger.js";

const DB_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/** @type {import("postgres").Sql | null} */
let sql = null;
let databaseName = null;

export function parseDatabaseUrl(rawUrl) {
  const url = new URL(rawUrl);
  const database = decodeURIComponent(url.pathname.replace(/^\//, "")).split("/")[0];

  if (!database || !DB_NAME_RE.test(database)) {
    throw new Error(`Invalid database name in DATABASE_URL: "${database}"`);
  }

  const schema = url.searchParams.get("schema") || "public";
  url.searchParams.delete("schema");

  const adminUrl = new URL(url.toString());
  adminUrl.pathname = "/postgres";

  return {
    database,
    schema,
    connectionUrl: url.toString(),
    adminUrl: adminUrl.toString(),
  };
}

async function ensureDatabaseExists() {
  const { database, adminUrl } = parseDatabaseUrl(config.databaseUrl);
  databaseName = database;

  const admin = postgres(adminUrl, {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
    onnotice: () => {},
  });

  try {
    const rows = await admin`
      select 1 as ok
      from pg_database
      where datname = ${database}
    `;

    if (rows.length === 0) {
      log.note("creating database", database);
      await admin.unsafe(`CREATE DATABASE "${database}"`);
    }
  } finally {
    await admin.end({ timeout: 5 });
  }
}

export async function initPostgres() {
  if (sql) return sql;

  const { connectionUrl, schema, database } = parseDatabaseUrl(config.databaseUrl);
  databaseName = database;
  await ensureDatabaseExists();

  sql = postgres(connectionUrl, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {},
    connection: {
      search_path: schema,
    },
  });

  return sql;
}

export function getSql() {
  if (!sql) {
    throw new Error("PostgreSQL is not initialized. Call initPostgres() first.");
  }
  return sql;
}

export function getDatabaseName() {
  return databaseName;
}

export async function pingPostgres() {
  const rows = await getSql()`select 1 as ok`;
  return rows[0]?.ok === 1;
}

export async function closePostgres() {
  if (!sql) return;
  await sql.end({ timeout: 5 });
  sql = null;
}
