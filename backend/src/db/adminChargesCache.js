import { log } from "../lib/logger.js";
import { listCardChargesAdmin } from "./cardCharges.js";
import { redis } from "./redis.js";

const STATUSES = ["pending", "approved", "rejected", "all"];
const DATA_KEY = (status) => `admin:charges:data:${status}`;
const VER_KEY = (status) => `admin:charges:ver:${status}`;
const CACHE_TTL_SECONDS = 60 * 10;

function normalizeStatus(status) {
  const value = String(status || "pending");
  return STATUSES.includes(value) ? value : "pending";
}

async function loadVersion(status) {
  const existing = await redis.get(VER_KEY(status));
  if (existing) return existing;
  const version = String(Date.now());
  await redis.set(VER_KEY(status), version);
  return version;
}

export async function invalidateAdminChargesCache() {
  const version = String(Date.now());
  const multi = redis.multi();
  for (const status of STATUSES) {
    multi.set(VER_KEY(status), version);
    multi.del(DATA_KEY(status));
  }
  await multi.exec();
  log.event("cache", `admin charges invalidate ver:${version}`);
  return version;
}

async function buildAdminChargesPayload(status) {
  const version = await loadVersion(status);
  const charges = await listCardChargesAdmin({ status });
  return {
    version,
    cachedAt: new Date().toISOString(),
    status,
    charges,
  };
}

export async function getAdminCharges(status = "pending") {
  const key = normalizeStatus(status);
  const cached = await redis.get(DATA_KEY(key));
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      await redis.del(DATA_KEY(key));
    }
  }

  log.event("cache", `admin charges rebuild status:${key}`);
  const payload = await buildAdminChargesPayload(key);
  await redis.set(DATA_KEY(key), JSON.stringify(payload), "EX", CACHE_TTL_SECONDS);
  return payload;
}

export async function syncAdminCharges(status = "pending", clientVersion = "") {
  const key = normalizeStatus(status);
  const currentVersion = await loadVersion(key);
  if (clientVersion && String(clientVersion) === String(currentVersion)) {
    return { changed: false, version: currentVersion, status: key };
  }

  const payload = await getAdminCharges(key);
  log.event(
    "cache",
    `admin charges sync changed status:${key} count:${payload.charges.length}`,
  );
  return { changed: true, ...payload };
}
