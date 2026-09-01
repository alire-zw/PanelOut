import { redis } from "./redis.js";
import { findPasarGuardPanelById } from "./pasarguardPanels.js";
import { getPricingSettings } from "./pricingSettings.js";
import {
  listUserPanelSubscriptions,
  OutboundServiceType,
  PanelServiceType,
} from "./userPanelSubscriptions.js";
import { getUserByTelegramId } from "./users.js";
import { PANEL_TRIAL_VOLUME_GB, getPanelAdminLiveStats } from "../lib/panelProvision.js";
import { getOutboundUserLiveStats } from "../lib/outboundProvision.js";
import {
  calculateTrafficBytesForCostIrt,
  formatTrafficGb,
  GB_BYTES,
  normalizeTrafficBytes,
  toBigInt,
} from "../lib/usageBillingMath.js";
import { log } from "../lib/logger.js";

const DATA_KEY = (telegramUserId) => `user:panels:data:${telegramUserId}`;
const VER_KEY = (telegramUserId) => `user:panels:ver:${telegramUserId}`;
const CACHE_TTL_SECONDS = 60 * 60 * 24;
const LIVE_REFRESH_INFLIGHT = new Set();

async function loadVersion(telegramUserId) {
  const existing = await redis.get(VER_KEY(telegramUserId));
  if (existing) return existing;
  const version = String(Date.now());
  await redis.set(VER_KEY(telegramUserId), version);
  return version;
}

async function readCache(telegramUserId) {
  const raw = await redis.get(DATA_KEY(telegramUserId));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    await redis.del(DATA_KEY(telegramUserId));
    return null;
  }
}

async function writeCache(telegramUserId, payload, { bumpVersion = true } = {}) {
  const version = bumpVersion
    ? String(Date.now())
    : await loadVersion(telegramUserId);
  const next = {
    ...payload,
    version,
    cachedAt: new Date().toISOString(),
  };
  await redis
    .multi()
    .set(VER_KEY(telegramUserId), version)
    .set(DATA_KEY(telegramUserId), JSON.stringify(next), "EX", CACHE_TTL_SECONDS)
    .exec();
  return next;
}

export async function invalidateUserPanelsCache(telegramUserId) {
  const version = String(Date.now());
  await redis
    .multi()
    .set(VER_KEY(telegramUserId), version)
    .del(DATA_KEY(telegramUserId))
    .exec();
  log.event("cache", `panels invalidate tg:${telegramUserId} ver:${version}`);
  return version;
}

async function enrichOutboundRow(s, user, outboundPricePerGb, fetchLive) {
  const isVolume = s.serviceType === OutboundServiceType.VOLUME;
  const isUsage = s.serviceType === OutboundServiceType.USAGE;
  const displayWalletBalance = Number(user.balance) || 0;

  let live = null;
  if (fetchLive) {
    try {
      const panel = await findPasarGuardPanelById(s.panelId, { includePassword: true });
      if (panel) {
        live = await getOutboundUserLiveStats(panel, s.clientUsername);
      }
    } catch (err) {
      log.warn("cache", `outbound live fail sub:${s.id} — ${err.message || err}`);
    }
  }

  const usedBytes =
    fetchLive && live?.usedTraffic != null
      ? live.usedTraffic
      : toBigInt(s.lastBilledTrafficBytes ?? 0);
  const usedGbLabel = formatTrafficGb(usedBytes);

  let remainingBytes = 0n;
  let capacityBytes = 0n;
  let capacityMode = isVolume ? "volume" : "wallet";

  if (isVolume && s.volumeGb > 0) {
    capacityBytes = BigInt(s.volumeGb) * GB_BYTES;
    if (live?.remainingBytes != null) {
      remainingBytes = live.remainingBytes;
    } else {
      remainingBytes = capacityBytes > usedBytes ? capacityBytes - usedBytes : 0n;
    }
  } else if (isUsage) {
    remainingBytes = calculateTrafficBytesForCostIrt(
      toBigInt(displayWalletBalance),
      outboundPricePerGb,
    );
    capacityBytes = usedBytes + remainingBytes;
  }

  const capacityGbLabel = formatTrafficGb(capacityBytes);
  const remainingGbLabel = formatTrafficGb(remainingBytes);
  const usedPercent =
    capacityBytes > 0n
      ? Math.min(100, Math.round(Number((usedBytes * 10000n) / capacityBytes) / 100))
      : usedBytes > 0n
        ? 100
        : 0;

  return {
    ...s,
    isOutbound: true,
    isOutboundVolume: isVolume,
    isOutboundUsage: isUsage,
    isReseller: false,
    isPersonal: false,
    isTrial: false,
    billingWallet: "main",
    displayWalletBalance,
    usagePricePerGb: outboundPricePerGb,
    trialVolumeGb: null,
    prepaidTrafficGb: null,
    live: {
      available: Boolean(live?.available),
      totalUsers: null,
      maxUsers: null,
      usedTrafficBytes: String(usedBytes),
      usedTrafficGb: usedGbLabel,
      remainingTrafficBytes: String(remainingBytes),
      remainingTrafficGb: remainingGbLabel,
      capacityTrafficBytes: String(capacityBytes),
      capacityTrafficGb: capacityGbLabel,
      usedPercent,
      capacityMode,
      adminEnabled: live?.enabled ?? null,
    },
    totalUsers: null,
    usedTrafficGb: usedGbLabel,
    remainingTrafficGb: remainingGbLabel,
    capacityTrafficGb: capacityGbLabel,
    usedPercent,
    capacityMode,
  };
}

async function enrichPanelRow(s, user, pricePerGb, fetchLive) {
  if (
    s.serviceType === OutboundServiceType.VOLUME ||
    s.serviceType === OutboundServiceType.USAGE
  ) {
    return enrichOutboundRow(s, user, pricePerGb, fetchLive);
  }

  const isReseller = s.serviceType === PanelServiceType.RESELLER;
  const isTrial = s.serviceType === PanelServiceType.TRIAL;
  const isPersonal = s.serviceType === PanelServiceType.USAGE;
  const displayWalletBalance = isReseller
    ? s.walletBalance
    : Number(user.balance) || 0;

  let live = null;
  if (fetchLive) {
    try {
      const panel = await findPasarGuardPanelById(s.panelId, {
        includePassword: true,
      });
      if (panel) {
        live = await getPanelAdminLiveStats(panel, s.clientUsername);
      }
    } catch (err) {
      log.warn("cache", `panels live fail sub:${s.id} — ${err.message || err}`);
    }
  }

  const usedBytes =
    fetchLive && live?.usedTraffic != null
      ? live.usedTraffic
      : toBigInt(s.lastBilledTrafficBytes ?? 0);
  const usedGbLabel = formatTrafficGb(usedBytes);
  const prepaidBytes = normalizeTrafficBytes(s.prepaidTrafficBytes);
  const walletRemaining = calculateTrafficBytesForCostIrt(
    toBigInt(displayWalletBalance),
    pricePerGb,
  );

  let remainingBytes = 0n;
  let capacityBytes = 0n;
  let capacityMode = "wallet";

  if (isTrial) {
    capacityMode = "trial";
    capacityBytes = BigInt(PANEL_TRIAL_VOLUME_GB) * GB_BYTES;
    remainingBytes =
      capacityBytes > usedBytes ? capacityBytes - usedBytes : 0n;
  } else if (prepaidBytes > 0n && usedBytes < prepaidBytes) {
    capacityMode = "prepaid";
    const prepaidLeft = prepaidBytes - usedBytes;
    remainingBytes = prepaidLeft + walletRemaining;
    capacityBytes = usedBytes + remainingBytes;
  } else {
    remainingBytes = walletRemaining;
    capacityBytes = usedBytes + remainingBytes;
  }

  const capacityGbLabel = formatTrafficGb(capacityBytes);
  const remainingGbLabel = formatTrafficGb(remainingBytes);
  const usedPercent =
    capacityBytes > 0n
      ? Math.min(
          100,
          Math.round(Number((usedBytes * 10000n) / capacityBytes) / 100),
        )
      : usedBytes > 0n
        ? 100
        : 0;

  return {
    ...s,
    isReseller,
    isPersonal,
    isTrial,
    billingWallet: isReseller ? "panel" : "main",
    displayWalletBalance,
    usagePricePerGb: pricePerGb,
    trialVolumeGb: isTrial ? PANEL_TRIAL_VOLUME_GB : null,
    prepaidTrafficGb: prepaidBytes > 0n ? formatTrafficGb(prepaidBytes) : null,
    live: {
      available: Boolean(live),
      totalUsers: live?.totalUsers ?? null,
      maxUsers: live?.maxUsers ?? null,
      usedTrafficBytes: String(usedBytes),
      usedTrafficGb: usedGbLabel,
      remainingTrafficBytes: String(remainingBytes),
      remainingTrafficGb: remainingGbLabel,
      capacityTrafficBytes: String(capacityBytes),
      capacityTrafficGb: capacityGbLabel,
      usedPercent,
      capacityMode,
      adminEnabled: live?.enabled ?? null,
    },
    totalUsers: live?.totalUsers ?? null,
    usedTrafficGb: usedGbLabel,
    remainingTrafficGb: remainingGbLabel,
    capacityTrafficGb: capacityGbLabel,
    usedPercent,
    capacityMode,
  };
}

export async function buildMyPanelsPayload(telegramUserId, { fetchLive = false } = {}) {
  const user = await getUserByTelegramId(telegramUserId);
  if (!user) {
    const err = new Error("کاربر یافت نشد");
    err.status = 404;
    throw err;
  }

  const pricing = await getPricingSettings();
  const panelPricePerGb = Number(pricing.panelUsagePricePerGb) || 4000;
  const outboundPricePerGb = Number(pricing.outboundPricePerGb) || panelPricePerGb;
  const all = await listUserPanelSubscriptions(user.id);
  const visible = all.filter(
    (s) => s.status === "active" || s.status === "suspended",
  );

  const panels = await Promise.all(
    visible.map((s) => {
      const price =
        s.serviceType === OutboundServiceType.VOLUME ||
        s.serviceType === OutboundServiceType.USAGE
          ? outboundPricePerGb
          : panelPricePerGb;
      return enrichPanelRow(s, user, price, fetchLive);
    }),
  );

  return {
    userBalance: Number(user.balance) || 0,
    usagePricePerGb: panelPricePerGb,
    outboundPricePerGb,
    panels,
    liveSyncedAt: fetchLive ? new Date().toISOString() : null,
  };
}

export async function refreshMyPanelsLive(telegramUserId) {
  const key = String(telegramUserId);
  if (LIVE_REFRESH_INFLIGHT.has(key)) return readCache(telegramUserId);
  LIVE_REFRESH_INFLIGHT.add(key);
  try {
    const payload = await buildMyPanelsPayload(telegramUserId, { fetchLive: true });
    return writeCache(telegramUserId, payload, { bumpVersion: true });
  } finally {
    LIVE_REFRESH_INFLIGHT.delete(key);
  }
}

function scheduleMyPanelsLiveRefresh(telegramUserId) {
  const key = String(telegramUserId);
  if (LIVE_REFRESH_INFLIGHT.has(key)) return;
  void refreshMyPanelsLive(telegramUserId).catch((err) => {
    log.warn("cache", `panels live refresh fail tg:${telegramUserId} — ${err.message || err}`);
  });
}

export async function getMyPanelsCached(telegramUserId) {
  const cached = await readCache(telegramUserId);
  if (cached) {
    scheduleMyPanelsLiveRefresh(telegramUserId);
    return cached;
  }

  const fast = await buildMyPanelsPayload(telegramUserId, { fetchLive: false });
  const saved = await writeCache(telegramUserId, fast, { bumpVersion: true });
  scheduleMyPanelsLiveRefresh(telegramUserId);
  return saved;
}

export async function syncMyPanels(telegramUserId, clientVersion) {
  const refreshed = await refreshMyPanelsLive(telegramUserId);
  if (!refreshed) {
    const built = await buildMyPanelsPayload(telegramUserId, { fetchLive: true });
    const saved = await writeCache(telegramUserId, built, { bumpVersion: true });
    return { changed: true, ...saved };
  }

  if (clientVersion && String(clientVersion) === String(refreshed.version)) {
    return { changed: false, ...refreshed };
  }

  return { changed: true, ...refreshed };
}
