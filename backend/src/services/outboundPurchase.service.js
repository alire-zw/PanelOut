import { getSql } from "../db/postgres.js";
import { findPasarGuardPanelById } from "../db/pasarguardPanels.js";
import { getPricingSettings } from "../db/pricingSettings.js";
import {
  countNonDeactivatedOutboundUsageSubscriptions,
  createUserPanelSubscription,
  findUserPanelSubscriptionById,
  listUserOutboundSubscriptions,
  OutboundServiceType,
  updateUserPanelSubscription,
} from "../db/userPanelSubscriptions.js";
import { getUserByTelegramId } from "../db/users.js";
import { invalidateUserPanelsCache } from "../db/userPanelsCache.js";
import { invalidateWalletTransactionsCache } from "../db/walletTransactions.js";
import { log } from "../lib/logger.js";
import {
  getOutboundUsageMinimumBalanceIrt,
  getOutboundUsageRequiredBalanceGb,
} from "../lib/usageBillingMath.js";
import {
  clampOutboundVolumeGb,
  DEFAULT_OUTBOUND_VOLUME_GB,
  MAX_OUTBOUND_VOLUME_GB,
} from "../lib/outboundVolumeSteps.js";
import { getOutboundVolumeQuote } from "../lib/outboundVolumePricing.js";
import {
  provisionOutboundUsageUser,
  provisionOutboundVolumeUser,
  setOutboundUserStatus,
} from "../lib/outboundProvision.js";
import { buildBaseUrl } from "../lib/pasarguardService.js";

export class OutboundServiceError extends Error {
  constructor(message, code = "INVALID_INPUT", status = 400) {
    super(message);
    this.name = "OutboundServiceError";
    this.code = code;
    this.status = status;
  }
}

export async function findEligibleOutboundPanels(kind) {
  const sql = getSql();
  const rows =
    kind === "usage"
      ? await sql`
          SELECT * FROM pasarguard_panels
          WHERE is_active = TRUE
            AND sales_enabled = TRUE
            AND outbound_usage_enabled = TRUE
          ORDER BY priority ASC, created_at DESC
        `
      : await sql`
          SELECT * FROM pasarguard_panels
          WHERE is_active = TRUE
            AND sales_enabled = TRUE
            AND outbound_volume_enabled = TRUE
          ORDER BY priority ASC, created_at DESC
        `;

  const panels = [];
  for (const row of rows) {
    const panel = await findPasarGuardPanelById(row.id, { includePassword: true });
    if (panel) panels.push(panel);
  }

  log.event(
    "outbound",
    `findEligibleOutboundPanels (${kind}) found ${panels.length}`,
  );

  return panels;
}

function pickRandomPanel(panels) {
  if (!panels.length) return null;
  return panels[Math.floor(Math.random() * panels.length)];
}

export async function getOutboundOptions(telegramUserId) {
  const user = await getUserByTelegramId(telegramUserId);
  if (!user) {
    throw new OutboundServiceError("کاربر یافت نشد", "USER_NOT_FOUND", 404);
  }

  const pricing = await getPricingSettings();
  const pricePerGb = pricing.outboundPricePerGb;
  const existingUsageCount = await countNonDeactivatedOutboundUsageSubscriptions(user.id);
  const requiredGb = getOutboundUsageRequiredBalanceGb(existingUsageCount);
  const minBalanceIrt = getOutboundUsageMinimumBalanceIrt(pricePerGb, existingUsageCount);
  const balance = Number(user.balance) || 0;

  const volumePanels = await findEligibleOutboundPanels("volume");
  const usagePanels = await findEligibleOutboundPanels("usage");
  const subscriptions = await listUserOutboundSubscriptions(user.id);

  return {
    pricing: {
      pricePerGb,
      defaultVolumeGb: DEFAULT_OUTBOUND_VOLUME_GB,
      maxVolumeGb: MAX_OUTBOUND_VOLUME_GB,
      usageMinBalanceGb: requiredGb,
      usageMinBalanceIrt: minBalanceIrt,
      usageExistingCount: existingUsageCount,
    },
    availability: {
      volume: volumePanels.length > 0,
      usage: usagePanels.length > 0,
    },
    user: {
      balance,
      hasEnoughBalanceForUsage: balance >= minBalanceIrt,
    },
    subscriptions,
    canPurchaseVolume: volumePanels.length > 0,
    canActivateUsage: usagePanels.length > 0 && balance >= minBalanceIrt,
  };
}

export async function purchaseOutboundVolume(telegramUserId, rawVolumeGb) {
  const volumeGb = clampOutboundVolumeGb(rawVolumeGb);
  const user = await getUserByTelegramId(telegramUserId);
  if (!user) {
    throw new OutboundServiceError("کاربر یافت نشد", "USER_NOT_FOUND", 404);
  }

  const panels = await findEligibleOutboundPanels("volume");
  if (!panels.length) {
    throw new OutboundServiceError(
      "در حال حاضر سرور اوتباند حجمی در دسترس نیست",
      "NO_SERVER",
      503,
    );
  }

  const pricing = await getPricingSettings();
  const quote = getOutboundVolumeQuote(volumeGb, pricing.outboundPricePerGb);
  const amountIrt = quote.amountIrt;

  const sql = getSql();
  const panel = pickRandomPanel(panels);

  const result = await sql.begin(async (tx) => {
    const [lockedUser] = await tx`
      SELECT * FROM users WHERE id = ${user.id} FOR UPDATE
    `;
    const balance = Number(lockedUser.balance) || 0;
    if (balance < amountIrt) {
      throw new OutboundServiceError(
        "موجودی کیف پول کافی نیست",
        "INSUFFICIENT_BALANCE",
        402,
      );
    }

    await tx`
      UPDATE users SET balance = balance - ${amountIrt} WHERE id = ${user.id}
    `;

    let provisioned;
    try {
      provisioned = await provisionOutboundVolumeUser(panel, {
        volumeGb,
        telegramUserId,
      });
    } catch (err) {
      throw new OutboundServiceError(
        err.message || "خطا در ایجاد سرویس اوتباند",
        "PROVISION_FAILED",
        502,
      );
    }

    const subscription = await createUserPanelSubscription(
      {
        userRowId: user.id,
        panelId: panel.id,
        serviceType: OutboundServiceType.VOLUME,
        clientUsername: provisioned.clientEmail,
        panelAdminId: null,
        panelUrl: buildBaseUrl(panel),
        status: "active",
        paymentMethod: "wallet",
        connectionLink: provisioned.subscriptionUrl,
        volumeGb,
        purchaseAmountIrt: amountIrt,
        lastBilledTrafficBytes: String(provisioned.usedTrafficBytes ?? 0n),
        lastBilledAt: new Date(),
      },
      tx,
    );

    return {
      subscription,
      credentials: {
        connectionLink: provisioned.subscriptionUrl,
        clientUsername: provisioned.clientEmail,
        volumeGb,
        amountIrt,
        discountPercent: quote.discountPercent,
      },
      userBalance: balance - amountIrt,
    };
  });

  await invalidateUserPanelsCache(telegramUserId);
  await invalidateWalletTransactionsCache(telegramUserId);

  log.event(
    "outbound",
    `volume purchase tg:${telegramUserId} gb:${volumeGb} amount:${amountIrt}`,
  );

  return result;
}

export async function activateOutboundUsage(telegramUserId) {
  const user = await getUserByTelegramId(telegramUserId);
  if (!user) {
    throw new OutboundServiceError("کاربر یافت نشد", "USER_NOT_FOUND", 404);
  }

  const panels = await findEligibleOutboundPanels("usage");
  if (!panels.length) {
    throw new OutboundServiceError(
      "در حال حاضر سرور اوتباند مصرفی در دسترس نیست",
      "NO_SERVER",
      503,
    );
  }

  const pricing = await getPricingSettings();
  const existingCount = await countNonDeactivatedOutboundUsageSubscriptions(user.id);
  const minBalanceIrt = getOutboundUsageMinimumBalanceIrt(
    pricing.outboundPricePerGb,
    existingCount,
  );
  const balance = Number(user.balance) || 0;

  if (balance < minBalanceIrt) {
    throw new OutboundServiceError(
      `حداقل موجودی ${minBalanceIrt.toLocaleString("en-US")} تومان برای فعال‌سازی لازم است`,
      "INSUFFICIENT_BALANCE",
      402,
    );
  }

  const panel = pickRandomPanel(panels);

  let provisioned;
  try {
    provisioned = await provisionOutboundUsageUser(panel, { telegramUserId });
  } catch (err) {
    throw new OutboundServiceError(
      err.message || "خطا در ایجاد سرویس اوتباند مصرفی",
      "PROVISION_FAILED",
      502,
    );
  }

  const usedBytes = provisioned.usedTrafficBytes ?? 0n;

  const subscription = await createUserPanelSubscription({
    userRowId: user.id,
    panelId: panel.id,
    serviceType: OutboundServiceType.USAGE,
    clientUsername: provisioned.clientEmail,
    panelAdminId: null,
    panelUrl: buildBaseUrl(panel),
    status: "active",
    paymentMethod: "wallet",
    connectionLink: provisioned.subscriptionUrl,
    volumeGb: 0,
    lastBilledTrafficBytes: String(usedBytes),
    lastBilledAt: new Date(),
  });

  await invalidateUserPanelsCache(telegramUserId);

  log.event(
    "outbound",
    `usage activate tg:${telegramUserId} user:${provisioned.clientEmail}`,
  );

  return {
    subscription,
    credentials: {
      connectionLink: provisioned.subscriptionUrl,
      clientUsername: provisioned.clientEmail,
    },
  };
}

export async function deactivateOutboundUsage(telegramUserId, subscriptionId) {
  const user = await getUserByTelegramId(telegramUserId);
  if (!user) {
    throw new OutboundServiceError("کاربر یافت نشد", "USER_NOT_FOUND", 404);
  }

  const sub = await findUserPanelSubscriptionById(subscriptionId, user.id);
  if (!sub || sub.serviceType !== OutboundServiceType.USAGE) {
    throw new OutboundServiceError("اشتراک یافت نشد", "NOT_FOUND", 404);
  }

  if (sub.status === "deactivated") {
    throw new OutboundServiceError("این سرویس قبلاً غیرفعال شده است", "ALREADY_DEACTIVATED", 409);
  }

  const panel = await findPasarGuardPanelById(sub.panelId, { includePassword: true });
  if (panel) {
    try {
      await setOutboundUserStatus(panel, sub.clientUsername, "disabled");
    } catch (err) {
      log.warn("outbound", `deactivate panel fail sub:${sub.id} — ${err.message || err}`);
    }
  }

  const updated = await updateUserPanelSubscription(sub.id, { status: "deactivated" });
  await invalidateUserPanelsCache(telegramUserId);

  return { subscription: updated };
}

export async function toggleOutboundVolume(telegramUserId, subscriptionId) {
  const user = await getUserByTelegramId(telegramUserId);
  if (!user) {
    throw new OutboundServiceError("کاربر یافت نشد", "USER_NOT_FOUND", 404);
  }

  const sub = await findUserPanelSubscriptionById(subscriptionId, user.id);
  if (!sub || sub.serviceType !== OutboundServiceType.VOLUME) {
    throw new OutboundServiceError("اشتراک یافت نشد", "NOT_FOUND", 404);
  }

  if (sub.status === "deactivated") {
    throw new OutboundServiceError(
      "سرویس حجمی غیرفعال‌شده قابل فعال‌سازی مجدد نیست",
      "DEACTIVATED",
      409,
    );
  }

  const panel = await findPasarGuardPanelById(sub.panelId, { includePassword: true });
  if (!panel) {
    throw new OutboundServiceError("سرور یافت نشد", "NO_SERVER", 503);
  }

  const nextStatus = sub.status === "active" ? "suspended" : "active";
  const panelStatus = nextStatus === "active" ? "active" : "disabled";

  await setOutboundUserStatus(panel, sub.clientUsername, panelStatus);
  const updated = await updateUserPanelSubscription(sub.id, { status: nextStatus });
  await invalidateUserPanelsCache(telegramUserId);

  return { subscription: updated };
}

export async function getMyOutbound(telegramUserId) {
  const { getMyPanelsCached } = await import("../db/userPanelsCache.js");
  const payload = await getMyPanelsCached(telegramUserId);
  const outbound = payload.panels.filter(
    (p) =>
      p.serviceType === OutboundServiceType.VOLUME ||
      p.serviceType === OutboundServiceType.USAGE,
  );
  return {
    userBalance: payload.userBalance,
    subscriptions: outbound,
    version: payload.version,
    cachedAt: payload.cachedAt,
  };
}

export function getOutboundVolumeQuoteForUser(volumeGb, pricePerGb) {
  return getOutboundVolumeQuote(volumeGb, pricePerGb);
}
