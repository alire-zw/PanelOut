import { log } from "../lib/logger.js";
import { listBankCards } from "./bankCards.js";
import { redis } from "./redis.js";

const SCOPES = ["all", "active"];
const DATA_KEY = (scope) => `bank:cards:data:${scope}`;
const VER_KEY = (scope) => `bank:cards:ver:${scope}`;
const CACHE_TTL_SECONDS = 60 * 10;

function normalizeScope(scope) {
  return scope === "active" ? "active" : "all";
}

async function loadVersion(scope) {
  const existing = await redis.get(VER_KEY(scope));
  if (existing) return existing;
  const version = String(Date.now());
  await redis.set(VER_KEY(scope), version);
  return version;
}

export async function invalidateBankCardsCache() {
  const version = String(Date.now());
  const multi = redis.multi();
  for (const scope of SCOPES) {
    multi.set(VER_KEY(scope), version);
    multi.del(DATA_KEY(scope));
  }
  await multi.exec();
  log.event("cache", `bank cards invalidate ver:${version}`);
  return version;
}

async function buildPayload(scope) {
  const version = await loadVersion(scope);
  const cards = await listBankCards({ activeOnly: scope === "active" });
  return {
    version,
    cachedAt: new Date().toISOString(),
    scope,
    cards,
  };
}

export async function getBankCardsCached(scope = "all") {
  const key = normalizeScope(scope);
  const cached = await redis.get(DATA_KEY(key));
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      await redis.del(DATA_KEY(key));
    }
  }

  log.event("cache", `bank cards rebuild scope:${key}`);
  const payload = await buildPayload(key);
  await redis.set(DATA_KEY(key), JSON.stringify(payload), "EX", CACHE_TTL_SECONDS);
  return payload;
}

export async function syncBankCardsCached(scope = "all", clientVersion = "") {
  const key = normalizeScope(scope);
  const currentVersion = await loadVersion(key);
  if (clientVersion && String(clientVersion) === String(currentVersion)) {
    return { changed: false, version: currentVersion, scope: key };
  }

  const payload = await getBankCardsCached(key);
  log.event(
    "cache",
    `bank cards sync changed scope:${key} count:${payload.cards.length}`,
  );
  return { changed: true, ...payload };
}
