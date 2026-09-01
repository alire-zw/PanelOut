import { getSql } from "../db/postgres.js";
import {
  addTakenUsername,
  findPasarGuardPanelById,
  isPanelUsernameTaken,
} from "../db/pasarguardPanels.js";
import { getPricingSettings } from "../db/pricingSettings.js";
import {
  allocateToPanelWallet,
  createUserPanelSubscription,
  findUserPanelSubscription,
  findUserPanelSubscriptionById,
  findPanelSubscriptionByUsername,
  listUserPanelSubscriptions,
  listUserResellerPanels,
  PanelServiceType,
  updateUserPanelSubscription,
  withdrawFromPanelWallet,
} from "../db/userPanelSubscriptions.js";
import {
  getUserByTelegramId,
  saveUserPanelAdminPassword,
  setHasClaimedTrial,
} from "../db/users.js";
import { log } from "../lib/logger.js";
import { generatePanelAdminPassword } from "../lib/panelPassword.js";
import {
  createPanelTrialAdmin,
  createPanelUsageAdmin,
  lookupLegacyPanelAdmin,
  convertLegacyPanelToUnlimited,
  getPanelAdminLiveStats,
  getPanelUsageMinimumBalanceIrt,
  getProvisionClient,
  PANEL_TRIAL_VOLUME_GB,
  PANEL_USAGE_MIN_BALANCE_GB,
  updatePanelAdminPassword,
  upgradeTrialAdminToPanelUsage,
} from "../lib/panelProvision.js";
import {
  calculateTrafficBytesForCostIrt,
  formatTrafficGb,
  GB_BYTES,
  normalizeTrafficBytes,
  toBigInt,
} from "../lib/usageBillingMath.js";
import { normalizePanelUsername, trimPanelUsername, panelUsernameError } from "../lib/panelUsername.js";

export class PanelServiceError extends Error {
  constructor(message, code = "INVALID_INPUT", status = 400) {
    super(message);
    this.name = "PanelServiceError";
    this.code = code;
    this.status = status;
  }
}

export async function findEligiblePanels(kind) {
  const sql = getSql();
  const rows =
    kind === "usage"
      ? await sql`
          SELECT * FROM pasarguard_panels
          WHERE is_active = TRUE
            AND sales_enabled = TRUE
            AND panel_usage_enabled = TRUE
          ORDER BY priority ASC, created_at DESC
        `
      : await sql`
          SELECT * FROM pasarguard_panels
          WHERE is_active = TRUE
            AND sales_enabled = TRUE
          ORDER BY priority ASC, created_at DESC
        `;

  const panels = [];
  for (const row of rows) {
    const p = await findPasarGuardPanelById(row.id, { includePassword: true });
    if (p) panels.push(p);
  }

  log.event(
    "panel",
    `findEligiblePanels (${kind}) found ${panels.length} panels: ${panels.map((p) => `#${p.id} ${p.name} (prio:${p.priority})`).join(", ")}`,
  );

  return panels;
}

export async function findEligiblePanel(kind) {
  const panels = await findEligiblePanels(kind);
  return panels[0] || null;
}

export async function getPanelPurchaseOptions(telegramUserId) {
  const user = await getUserByTelegramId(telegramUserId);
  if (!user) {
    throw new PanelServiceError("کاربر یافت نشد", "USER_NOT_FOUND", 404);
  }

  const pricing = await getPricingSettings();
  const usagePricePerGb = pricing.panelUsagePricePerGb;
  const trial = await findUserPanelSubscription(user.id, PanelServiceType.TRIAL);
  const usage = await findUserPanelSubscription(user.id, PanelServiceType.USAGE);
  const resellers = await listUserResellerPanels(user.id);
  const minBalanceIrt = getPanelUsageMinimumBalanceIrt(usagePricePerGb);
  const balance = Number(user.balance) || 0;

  const trialPanel = await findEligiblePanel("trial");
  const usagePanel = await findEligiblePanel("usage");

  const hasClaimedTrial = Boolean(user.has_claimed_trial) || Boolean(trial);
  const hasUsage = Boolean(usage);
  const hasAnyPanel = hasUsage || Boolean(trial);

  const password = user.panel_admin_password || usage?.adminPassword || trial?.adminPassword || null;

  return {
    pricing: {
      trialVolumeGb: PANEL_TRIAL_VOLUME_GB,
      usageMinBalanceGb: PANEL_USAGE_MIN_BALANCE_GB,
      usagePricePerGb,
      usageMinBalanceIrt: minBalanceIrt,
      outboundPricePerGb: pricing.outboundPricePerGb,
    },
    availability: {
      trial: Boolean(trialPanel),
      usage: Boolean(usagePanel),
      reseller: Boolean(usagePanel),
    },
    user: {
      balance,
      hasEnoughBalanceForUsage: balance >= minBalanceIrt,
      panelAdminPassword: password,
      hasClaimedTrial,
    },
    subscriptions: {
      trial: trial
        ? {
            ...trial,
            adminPassword: trial.adminPassword || password,
            hasPassword: Boolean(password),
          }
        : null,
      usage: usage
        ? {
            ...usage,
            adminPassword: usage.adminPassword || password,
            hasPassword: Boolean(password),
          }
        : null,
      resellers: resellers.map((item) => ({
        ...item,
        hasPassword: Boolean(item.adminPassword),
      })),
    },
    canClaimTrial: !hasClaimedTrial && !hasAnyPanel && Boolean(trialPanel),
    canActivateUsage: !usage && Boolean(usagePanel) && balance >= minBalanceIrt,
    canUpgradeTrialToUsage:
      Boolean(trial) &&
      trial.status === "active" &&
      !usage &&
      Boolean(usagePanel) &&
      balance >= minBalanceIrt,
    // Reseller panel: only after personal usage panel exists
    canActivateReseller: hasUsage && Boolean(usagePanel) && balance >= minBalanceIrt,
    canImportExisting: true,
  };
}

export async function activatePanelTrial(telegramUserId, rawUsername) {
  const usernameError = panelUsernameError(rawUsername);
  if (usernameError) {
    throw new PanelServiceError(usernameError, "INVALID_USERNAME");
  }

  const username = normalizePanelUsername(rawUsername);
  if (await isPanelUsernameTaken(username)) {
    throw new PanelServiceError(
      "این نام کاربری قبلاً انتخاب شده است، نام دیگری ثبت کنید",
      "USERNAME_TAKEN",
      409,
    );
  }

  const user = await getUserByTelegramId(telegramUserId);
  if (!user) {
    throw new PanelServiceError("کاربر یافت نشد", "USER_NOT_FOUND", 404);
  }

  const existingTrial = await findUserPanelSubscription(user.id, PanelServiceType.TRIAL);
  const existingUsage = await findUserPanelSubscription(user.id, PanelServiceType.USAGE);
  if (user.has_claimed_trial || existingTrial || existingUsage) {
    throw new PanelServiceError(
      "اکانت تست قبلاً دریافت شده است یا در حال حاضر سرویس پنل دارید",
      "TRIAL_ALREADY_CLAIMED",
      409,
    );
  }

  const candidatePanels = await findEligiblePanels("trial");
  if (candidatePanels.length === 0) {
    throw new PanelServiceError("در حال حاضر پنل تست در دسترس نیست", "PANEL_UNAVAILABLE", 503);
  }

  let provision = null;
  let chosenPanel = null;
  let lastError = null;

  for (const panel of candidatePanels) {
    try {
      provision = await createPanelTrialAdmin(panel, {
        username,
        telegramUserId,
      });
      chosenPanel = panel;
      break;
    } catch (err) {
      lastError = err;
      log.warn("panel", `Trial provision failed on panel ${panel.id} (${panel.name}): ${err.message || err}`);
    }
  }

  if (!provision || !chosenPanel) {
    throw lastError || new PanelServiceError("خطا در ساخت پنل تست", "PROVISION_FAILED", 500);
  }

  await saveUserPanelAdminPassword(user.user_id, provision.password);
  await setHasClaimedTrial(user.user_id, true);
  void addTakenUsername(provision.username);
  const subscription = await createUserPanelSubscription({
    userRowId: user.id,
    panelId: Number(chosenPanel.id),
    serviceType: PanelServiceType.TRIAL,
    clientUsername: provision.username,
    adminPassword: provision.password,
    panelAdminId: provision.adminId,
    panelUrl: provision.panelUrl,
    paymentMethod: "trial",
  });

  void import("../db/userPanelsCache.js")
    .then(({ invalidateUserPanelsCache }) => invalidateUserPanelsCache(telegramUserId))
    .catch(() => {});

  return {
    subscription,
    credentials: {
      username: provision.username,
      password: provision.password,
      panelUrl: provision.panelUrl,
      volumeGb: provision.volumeGb,
    },
  };
}

export async function activatePanelUsage(telegramUserId, rawUsername, options = {}) {
  const user = await getUserByTelegramId(telegramUserId);
  if (!user) {
    throw new PanelServiceError("کاربر یافت نشد", "USER_NOT_FOUND", 404);
  }

  const existingUsage = await findUserPanelSubscription(user.id, PanelServiceType.USAGE);
  if (existingUsage) {
    throw new PanelServiceError("پنل مصرفی قبلاً فعال شده است", "USAGE_ALREADY_ACTIVE", 409);
  }

  const pricing = await getPricingSettings();
  const minBalanceIrt = getPanelUsageMinimumBalanceIrt(pricing.panelUsagePricePerGb);
  const balance = Number(user.balance) || 0;
  if (balance < minBalanceIrt) {
    throw new PanelServiceError(
      `حداقل موجودی ${minBalanceIrt.toLocaleString("fa-IR")} تومان لازم است`,
      "INSUFFICIENT_BALANCE",
      402,
    );
  }

  const candidatePanels = await findEligiblePanels("usage");
  if (candidatePanels.length === 0) {
    throw new PanelServiceError("در حال حاضر پنل مصرفی در دسترس نیست", "PANEL_UNAVAILABLE", 503);
  }

  const trial = await findUserPanelSubscription(user.id, PanelServiceType.TRIAL);
  const requestedMode = options.mode || (trial && !rawUsername ? "upgrade" : "new");

  let provision;
  let chosenPanel;

  if (trial && requestedMode === "upgrade") {
    const trialPanel = await findPasarGuardPanelById(trial.panelId, { includePassword: true });
    chosenPanel = trialPanel?.isActive && trialPanel?.salesEnabled ? trialPanel : candidatePanels[0];
    provision = await upgradeTrialAdminToPanelUsage(chosenPanel, {
      username: trial.clientUsername,
      telegramUserId,
    });
    const existingPassword = user.panel_admin_password || trial.adminPassword || null;
    await updateUserPanelSubscription(Number(trial.id), {
      serviceType: PanelServiceType.USAGE,
      panelId: Number(chosenPanel.id),
      panelUrl: provision.panelUrl,
      panelAdminId: provision.adminId,
      adminPassword: existingPassword,
      paymentMethod: "wallet",
      status: "active",
      lastBilledTrafficBytes: provision.usedTraffic ?? 0n,
      lastBilledAt: new Date(),
    });
    await setHasClaimedTrial(user.user_id, true);
    const subscription = await findUserPanelSubscription(user.id, PanelServiceType.USAGE);
    return {
      subscription,
      credentials: {
        username: provision.username,
        password: existingPassword,
        panelUrl: provision.panelUrl,
        upgradedFromTrial: true,
      },
    };
  }

  const usernameError = panelUsernameError(rawUsername);
  if (usernameError) {
    throw new PanelServiceError(usernameError, "INVALID_USERNAME");
  }

  const username = normalizePanelUsername(rawUsername);
  if (await isPanelUsernameTaken(username)) {
    throw new PanelServiceError(
      "این نام کاربری قبلاً انتخاب شده است، نام دیگری ثبت کنید",
      "USERNAME_TAKEN",
      409,
    );
  }

  // If user previously had a trial subscription and chose to create a new user, deactivate trial
  if (trial) {
    try {
      const trialPanel = await findPasarGuardPanelById(trial.panelId, { includePassword: true });
      if (trialPanel) {
        const client = getProvisionClient(trialPanel);
        await client.authenticate().catch(() => {});
        await client.modifyAdmin(trial.clientUsername, { status: "disabled" }).catch(() => {});
      }
    } catch (err) {
      log.warn("panel", `Failed to deactivate previous trial admin in panel: ${err.message || err}`);
    }
    await updateUserPanelSubscription(Number(trial.id), {
      status: "deactivated",
    });
  }

  let lastError = null;
  for (const panel of candidatePanels) {
    try {
      provision = await createPanelUsageAdmin(panel, {
        username,
        telegramUserId,
      });
      chosenPanel = panel;
      break;
    } catch (err) {
      lastError = err;
      log.warn("panel", `Usage provision failed on panel ${panel.id} (${panel.name}): ${err.message || err}`);
    }
  }

  if (!provision || !chosenPanel) {
    throw lastError || new PanelServiceError("خطا در فعال‌سازی پنل مصرفی", "PROVISION_FAILED", 500);
  }

  await saveUserPanelAdminPassword(user.user_id, provision.password);
  await setHasClaimedTrial(user.user_id, true);
  void addTakenUsername(provision.username);
  const subscription = await createUserPanelSubscription({
    userRowId: user.id,
    panelId: Number(chosenPanel.id),
    serviceType: PanelServiceType.USAGE,
    clientUsername: provision.username,
    adminPassword: provision.password,
    panelAdminId: provision.adminId,
    panelUrl: provision.panelUrl,
    paymentMethod: "wallet",
    lastBilledTrafficBytes: provision.usedTraffic ?? 0n,
  });

  void import("../db/userPanelsCache.js")
    .then(({ invalidateUserPanelsCache }) => invalidateUserPanelsCache(telegramUserId))
    .catch(() => {});

  return {
    subscription,
    credentials: {
      username: provision.username,
      password: provision.password,
      panelUrl: provision.panelUrl,
      upgradedFromTrial: false,
    },
  };
}

export async function activatePanelReseller(telegramUserId, rawUsername) {
  const user = await getUserByTelegramId(telegramUserId);
  if (!user) {
    throw new PanelServiceError("کاربر یافت نشد", "USER_NOT_FOUND", 404);
  }

  const personalUsage = await findUserPanelSubscription(user.id, PanelServiceType.USAGE);
  if (!personalUsage) {
    throw new PanelServiceError(
      "ابتدا باید پنل مصرفی شخصی خود را فعال کنید",
      "PERSONAL_PANEL_REQUIRED",
      400,
    );
  }

  const pricing = await getPricingSettings();
  const minBalanceIrt = getPanelUsageMinimumBalanceIrt(pricing.panelUsagePricePerGb);
  const balance = Number(user.balance) || 0;
  if (balance < minBalanceIrt) {
    throw new PanelServiceError(
      `حداقل موجودی ${minBalanceIrt.toLocaleString("fa-IR")} تومان لازم است`,
      "INSUFFICIENT_BALANCE",
      402,
    );
  }

  const usernameError = panelUsernameError(rawUsername);
  if (usernameError) {
    throw new PanelServiceError(usernameError, "INVALID_USERNAME");
  }

  const username = normalizePanelUsername(rawUsername);
  if (await isPanelUsernameTaken(username)) {
    throw new PanelServiceError(
      "این نام کاربری قبلاً انتخاب شده است، نام دیگری ثبت کنید",
      "USERNAME_TAKEN",
      409,
    );
  }

  const candidatePanels = await findEligiblePanels("usage");
  if (candidatePanels.length === 0) {
    throw new PanelServiceError("در حال حاضر پنل ریسلری در دسترس نیست", "PANEL_UNAVAILABLE", 503);
  }

  let provision = null;
  let chosenPanel = null;
  let lastError = null;

  for (const panel of candidatePanels) {
    try {
      provision = await createPanelUsageAdmin(panel, {
        username,
        telegramUserId,
      });
      chosenPanel = panel;
      break;
    } catch (err) {
      lastError = err;
      log.warn(
        "panel",
        `Reseller provision failed on panel ${panel.id} (${panel.name}): ${err.message || err}`,
      );
    }
  }

  if (!provision || !chosenPanel) {
    throw lastError || new PanelServiceError("خطا در ساخت پنل ریسلری", "PROVISION_FAILED", 500);
  }

  void addTakenUsername(provision.username);
  const subscription = await createUserPanelSubscription({
    userRowId: user.id,
    panelId: Number(chosenPanel.id),
    serviceType: PanelServiceType.RESELLER,
    clientUsername: provision.username,
    adminPassword: provision.password,
    panelAdminId: provision.adminId,
    panelUrl: provision.panelUrl,
    paymentMethod: "wallet",
    walletBalance: 0,
    lastBilledTrafficBytes: provision.usedTraffic ?? 0n,
  });

  log.event(
    "panel",
    `reseller created tg:${telegramUserId} user:${provision.username} sub:${subscription.id}`,
  );

  void import("../db/userPanelsCache.js")
    .then(({ invalidateUserPanelsCache }) => invalidateUserPanelsCache(telegramUserId))
    .catch(() => {});

  return {
    subscription,
    credentials: {
      username: provision.username,
      password: provision.password,
      panelUrl: provision.panelUrl,
      isReseller: true,
    },
  };
}

function bytesToGbNumber(bytes) {
  const value = normalizeTrafficBytes(bytes);
  if (value <= 0n) return 0;
  return Number((value * 100n) / GB_BYTES) / 100;
}

async function assertLegacyImportAllowed(user, username, serviceType) {
  if (serviceType === PanelServiceType.USAGE) {
    const existingUsage = await findUserPanelSubscription(user.id, PanelServiceType.USAGE);
    if (existingUsage) {
      throw new PanelServiceError(
        "پنل مصرفی شخصی شما قبلاً ثبت شده است. برای پنل دیگر، نوع ریسلری را انتخاب کنید",
        "USAGE_ALREADY_ACTIVE",
        409,
      );
    }
  }

  const taken = await findPanelSubscriptionByUsername(username);
  if (taken) {
    const sameUser = String(taken.userRowId) === String(user.id);
    throw new PanelServiceError(
      sameUser
        ? "این پنل قبلاً در حساب شما ثبت شده است"
        : "این پنل متعلق به حساب دیگری است و قابل ثبت مجدد نیست",
      "USERNAME_TAKEN",
      409,
    );
  }
}

async function findLegacyAdminAcrossPanels(username, password) {
  const sql = getSql();
  const rows = await sql`
    SELECT id FROM pasarguard_panels
    WHERE is_active = TRUE
    ORDER BY priority ASC, created_at DESC
  `;

  let lastAuthError = null;

  for (const row of rows) {
    const panel = await findPasarGuardPanelById(row.id, { includePassword: true });
    if (!panel) continue;
    try {
      const found = await lookupLegacyPanelAdmin(panel, { username, password });
      if (!found) continue;
      return { provision: found, panel };
    } catch (err) {
      if (err.code === "INVALID_CREDENTIALS") {
        lastAuthError = err;
        continue;
      }
      log.warn(
        "panel",
        `legacy import lookup fail panel:${panel.id} — ${err.message || err}`,
      );
    }
  }

  throw lastAuthError
    || new PanelServiceError(
      "پنلی با این نام کاربری و رمز عبور پیدا نشد",
      "PANEL_NOT_FOUND",
      404,
    );
}

export async function previewExistingPanel(telegramUserId, rawUsername, rawPassword, kindInput) {
  const username = trimPanelUsername(rawUsername);
  if (!username) {
    throw new PanelServiceError("نام کاربری را وارد کنید", "INVALID_USERNAME");
  }
  const password = String(rawPassword || "");
  if (!password) {
    throw new PanelServiceError("رمز عبور را وارد کنید", "INVALID_PASSWORD");
  }

  const isReseller = kindInput === "reseller" || kindInput === PanelServiceType.RESELLER;
  const serviceType = isReseller ? PanelServiceType.RESELLER : PanelServiceType.USAGE;

  const user = await getUserByTelegramId(telegramUserId);
  if (!user) {
    throw new PanelServiceError("کاربر یافت نشد", "USER_NOT_FOUND", 404);
  }

  await assertLegacyImportAllowed(user, username, serviceType);
  const { provision } = await findLegacyAdminAcrossPanels(username, password);
  const prepaidBytes = normalizeTrafficBytes(provision.dataLimitBytes);

  if (prepaidBytes <= 0n) {
    throw new PanelServiceError(
      "ظرفیت این ادمین در سرور پنل یافت نشد. انتقال بدون حجم پرداخت‌شده ممکن نیست",
      "PREPAID_REQUIRED",
      400,
    );
  }

  return {
    username: provision.username,
    prepaidGb: bytesToGbNumber(prepaidBytes),
    usedTrafficGb: bytesToGbNumber(provision.usedTraffic),
    isReseller,
  };
}

export async function importExistingPanel(
  telegramUserId,
  rawUsername,
  rawPassword,
  kindInput,
) {
  const username = trimPanelUsername(rawUsername);
  if (!username) {
    throw new PanelServiceError("نام کاربری را وارد کنید", "INVALID_USERNAME");
  }
  const password = String(rawPassword || "");
  if (!password) {
    throw new PanelServiceError("رمز عبور را وارد کنید", "INVALID_PASSWORD");
  }

  const isReseller = kindInput === "reseller" || kindInput === PanelServiceType.RESELLER;
  const serviceType = isReseller ? PanelServiceType.RESELLER : PanelServiceType.USAGE;

  const user = await getUserByTelegramId(telegramUserId);
  if (!user) {
    throw new PanelServiceError("کاربر یافت نشد", "USER_NOT_FOUND", 404);
  }

  await assertLegacyImportAllowed(user, username, serviceType);
  const { provision, panel: chosenPanel } = await findLegacyAdminAcrossPanels(
    username,
    password,
  );

  const prepaidBytes = normalizeTrafficBytes(provision.dataLimitBytes);

  if (prepaidBytes <= 0n) {
    throw new PanelServiceError(
      "ظرفیت این ادمین در سرور پنل یافت نشد. انتقال بدون حجم پرداخت‌شده ممکن نیست",
      "PREPAID_REQUIRED",
      400,
    );
  }

  await convertLegacyPanelToUnlimited(chosenPanel, {
    username: provision.username,
    telegramUserId,
  });

  if (!isReseller) {
    await saveUserPanelAdminPassword(user.user_id, password);
  }
  void addTakenUsername(provision.username);

  const subscription = await createUserPanelSubscription({
    userRowId: user.id,
    panelId: Number(chosenPanel.id),
    serviceType,
    clientUsername: provision.username,
    adminPassword: password,
    panelAdminId: provision.adminId,
    panelUrl: provision.panelUrl,
    paymentMethod: "legacy_import",
    walletBalance: 0,
    lastBilledTrafficBytes: provision.usedTraffic ?? 0n,
    prepaidTrafficBytes: prepaidBytes,
  });

  log.event(
    "panel",
    `legacy imported tg:${telegramUserId} user:${provision.username} type:${serviceType} prepaid:${prepaidBytes} used:${provision.usedTraffic}`,
  );

  void import("../db/userPanelsCache.js")
    .then(({ invalidateUserPanelsCache, refreshMyPanelsLive }) =>
      invalidateUserPanelsCache(telegramUserId).then(() =>
        refreshMyPanelsLive(telegramUserId),
      ),
    )
    .catch(() => {});

  return {
    subscription,
    credentials: {
      username: provision.username,
      password,
      panelUrl: provision.panelUrl,
      prepaidGb: bytesToGbNumber(prepaidBytes),
      usedTrafficGb: bytesToGbNumber(provision.usedTraffic),
      imported: true,
      isReseller,
    },
  };
}

export async function getMyPanels(telegramUserId) {
  const { getMyPanelsCached } = await import("../db/userPanelsCache.js");
  return getMyPanelsCached(telegramUserId);
}

export async function allocatePanelBalance(
  telegramUserId,
  subscriptionId,
  amount,
  action = "increase",
) {
  const user = await getUserByTelegramId(telegramUserId);
  if (!user) {
    throw new PanelServiceError("کاربر یافت نشد", "USER_NOT_FOUND", 404);
  }

  const sub = await findUserPanelSubscriptionById(Number(subscriptionId), user.id);
  if (!sub) {
    throw new PanelServiceError("پنل یافت نشد", "PANEL_NOT_FOUND", 404);
  }
  if (sub.serviceType !== PanelServiceType.RESELLER) {
    throw new PanelServiceError(
      "مدیریت موجودی فقط برای پنل‌های ریسلری امکان‌پذیر است",
      "NOT_RESELLER",
      400,
    );
  }

  const isWithdraw = action === "decrease" || action === "withdraw";

  try {
    let result;
    if (isWithdraw) {
      result = await withdrawFromPanelWallet({
        userRowId: user.id,
        telegramId: telegramUserId,
        subscriptionId: Number(subscriptionId),
        amount,
      });
      log.event(
        "panel",
        `withdraw ${result.withdrawn} from sub:${subscriptionId} tg:${telegramUserId}`,
      );
    } else {
      result = await allocateToPanelWallet({
        userRowId: user.id,
        telegramId: telegramUserId,
        subscriptionId: Number(subscriptionId),
        amount,
      });
      log.event(
        "panel",
        `allocate ${result.allocated} to sub:${subscriptionId} tg:${telegramUserId}`,
      );

      // Reactivate reseller panel if it was suspended due to empty panel wallet
      void import("./panelUsageBilling.service.js")
        .then(({ reactivateSuspendedPanelsAfterWalletCredit }) =>
          reactivateSuspendedPanelsAfterWalletCredit(telegramUserId),
        )
        .catch(() => {});
    }

    return result;
  } catch (err) {
    throw new PanelServiceError(
      err.message || (isWithdraw ? "خطا در کسر موجودی" : "خطا در تخصیص"),
      err.code || (isWithdraw ? "WITHDRAW_FAILED" : "ALLOCATE_FAILED"),
      err.status || 500,
    );
  }
}

export async function resetPanelPassword(telegramUserId, subscriptionId) {
  const user = await getUserByTelegramId(telegramUserId);
  if (!user) {
    throw new PanelServiceError("کاربر یافت نشد", "USER_NOT_FOUND", 404);
  }

  const sub = await findUserPanelSubscriptionById(Number(subscriptionId), user.id);
  if (!sub) {
    throw new PanelServiceError("پنل یافت نشد", "PANEL_NOT_FOUND", 404);
  }

  if (sub.status === "deactivated") {
    throw new PanelServiceError("این پنل غیرفعال شده است", "PANEL_DEACTIVATED", 400);
  }

  const panel = await findPasarGuardPanelById(sub.panelId, { includePassword: true });
  if (!panel) {
    throw new PanelServiceError("سرور پنل در دسترس نیست", "PANEL_UNAVAILABLE", 503);
  }

  const newPassword = generatePanelAdminPassword();

  try {
    await updatePanelAdminPassword(panel, sub.clientUsername, newPassword);
  } catch (err) {
    log.error("panel", `reset password fail sub:${sub.id} user:${sub.clientUsername} — ${err.message}`);
    throw new PanelServiceError("تغییر رمز عبور در سرور پنل ناموفق بود", "RESET_PASSWORD_FAILED", 502);
  }

  await updateUserPanelSubscription(sub.id, { adminPassword: newPassword });

  if (sub.serviceType === PanelServiceType.USAGE || sub.serviceType === PanelServiceType.TRIAL) {
    await saveUserPanelAdminPassword(user.user_id, newPassword);
  }

  log.event("panel", `reset password sub:${sub.id} user:${sub.clientUsername} tg:${telegramUserId}`);

  void import("../db/userPanelsCache.js")
    .then(({ invalidateUserPanelsCache }) => invalidateUserPanelsCache(telegramUserId))
    .catch(() => {});

  return {
    subscriptionId: String(sub.id),
    password: newPassword,
    clientUsername: sub.clientUsername,
  };
}
