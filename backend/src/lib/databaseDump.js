import { spawn } from "node:child_process";
import { gzipSync } from "node:zlib";
import { config } from "../config.js";
import { parseDatabaseUrl } from "../db/postgres.js";
import { dumpDatabaseViaNode } from "./databaseDumpNode.js";
import { log } from "./logger.js";

const TELEGRAM_MAX_BYTES = 49 * 1024 * 1024;

function formatTimestampForFilename(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}${get("month")}${get("day")}-${get("hour")}${get("minute")}${get("second")}`;
}

function collectProcessOutput(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    const chunks = [];
    const errChunks = [];

    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.stderr.on("data", (chunk) => errChunks.push(chunk));

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code !== 0) {
        const stderr = Buffer.concat(errChunks).toString("utf8").trim();
        reject(new Error(stderr || `${command} exited with code ${code}`));
        return;
      }
      resolve(Buffer.concat(chunks));
    });
  });
}

function runPgDump(pgDumpPath, connectionUrl) {
  return collectProcessOutput(pgDumpPath, [
    "--no-owner",
    "--no-acl",
    "--dbname",
    connectionUrl,
  ]);
}

function runDockerPgDump(containerName, database, dbUser) {
  return collectProcessOutput("docker", [
    "exec",
    containerName,
    "pg_dump",
    "-U",
    dbUser,
    "--no-owner",
    "--no-acl",
    database,
  ]);
}

async function dumpDatabaseSqlBuffer(connectionUrl) {
  try {
    return await runPgDump(config.pgDumpPath, connectionUrl);
  } catch (pgDumpError) {
    const isMissingBinary =
      pgDumpError.code === "ENOENT" ||
      /not recognized/i.test(String(pgDumpError.message));

    if (isMissingBinary && config.databaseBackupDockerContainer) {
      try {
        const { database } = parseDatabaseUrl(config.databaseUrl);
        const dbUser = decodeURIComponent(new URL(connectionUrl).username || "postgres");
        return await runDockerPgDump(
          config.databaseBackupDockerContainer,
          database,
          dbUser,
        );
      } catch (dockerError) {
        log.warn(
          "backup",
          `pg_dump/docker unavailable — using node exporter (${dockerError.message || dockerError})`,
        );
      }
    } else if (!isMissingBinary) {
      log.warn(
        "backup",
        `pg_dump failed — using node exporter (${pgDumpError.message || pgDumpError})`,
      );
    } else {
      log.warn("backup", "pg_dump not found — using node exporter");
    }
  }

  return dumpDatabaseViaNode();
}

export async function createDatabaseBackupGzip() {
  const { connectionUrl, database } = parseDatabaseUrl(config.databaseUrl);
  const sqlBuffer = await dumpDatabaseSqlBuffer(connectionUrl);
  const gzipBuffer = gzipSync(sqlBuffer);

  if (gzipBuffer.length > TELEGRAM_MAX_BYTES) {
    throw new Error(
      `backup too large for Telegram (${gzipBuffer.length} bytes compressed)`,
    );
  }

  const timestamp = formatTimestampForFilename(new Date());
  const filename = `panelout-${database}-${timestamp}.sql.gz`;
  const sqlText = sqlBuffer.toString("utf8");
  const summaryLine = sqlText.match(/-- Summary:\s*(.+)/)?.[1]?.trim() || "";
  const tables = Number(summaryLine.match(/tables=(\d+)/)?.[1] || 0);
  const rows = Number(summaryLine.match(/rows=(\d+)/)?.[1] || 0);
  const sequences = Number(summaryLine.match(/sequences=(\d+)/)?.[1] || 0);
  const constraints = Number(summaryLine.match(/constraints=(\d+)/)?.[1] || 0);
  const indexes = Number(summaryLine.match(/indexes=(\d+)/)?.[1] || 0);

  return {
    buffer: gzipBuffer,
    filename,
    database,
    uncompressedBytes: sqlBuffer.length,
    compressedBytes: gzipBuffer.length,
    stats: { tables, rows, sequences, constraints, indexes, summaryLine },
  };
}
