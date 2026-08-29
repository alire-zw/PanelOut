import { getSql } from "../db/postgres.js";
import {
  addTakenUsername,
  findPasarGuardPanelById,
  isPanelUsernameTaken,
} from "../db/pasarguardPanels.js";
import {
  createUserPanelSubscription,
  findUserPanelSubscription,
  PanelServiceType,
  updateUserPanelSubscription,
} from "../db/userPanelSubscriptions.js";
import { getUserByTelegramId, saveUserPanelAdminPassword } from "../db/users.js";
import { log } from "../lib/logger.js";
import {
  createPanelTrialAdmin,
  createPanelUsageAdmin,
  getPanelUsageMinimumBalanceIrt,
  PANEL_TRIAL_VOLUME_GB,
  PANEL_USAGE_MIN_BALANCE_GB,
  PANEL_USAGE_PRICE_PER_GB,
  upgradeTrialAdminToPanelUsage,
} from "../lib/panelProvision.js";
import { normalizePanelUsername, panelUsernameError } from "../lib/panelUsername.js";

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

  const trial = await findUserPanelSubscription(user.id, PanelServiceType.TRIAL);
  const usage = await findUserPanelSubscription(user.id, PanelServiceType.USAGE);
  const minBalanceIrt = getPanelUsageMinimumBalanceIrt();
  const balance = Number(user.balance) || 0;

  const trialPanel = await findEligiblePanel("trial");
  const usagePanel = await findEligiblePanel("usage");

  return {
    pricing: {
      trialVolumeGb: PANEL_TRIAL_VOLUME_GB,
      usageMinBalanceGb: PANEL_USAGE_MIN_BALANCE_GB,
      usagePricePerGb: PANEL_USAGE_PRICE_PER_GB,
      usageMinBalanceIrt: minBalanceIrt,
    },
    availability: {
      trial: Boolean(trialPanel),
      usage: Boolean(usagePanel),
    },
    user: {
      balance,
      hasEnoughBalanceForUsage: balance >= minBalanceIrt,
    },
    subscriptions: {
      trial: trial ? { ...trial, hasPassword: Boolean(user.panelAdminPassword) } : null,
      usage: usage ? { ...usage, hasPassword: Boolean(user.panelAdminPassword) } : null,
    },
    canClaimTrial: !trial && Boolean(trialPanel),
    canActivateUsage: !usage && Boolean(usagePanel) && balance >= minBalanceIrt,
    canUpgradeTrialToUsage: Boolean(trial) && !usage && Boolean(usagePanel) && balance >= minBalanceIrt,
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

  const existing = await findUserPanelSubscription(user.id, PanelServiceType.TRIAL);
  if (existing) {
    throw new PanelServiceError("پنل تست قبلاً دریافت شده است", "TRIAL_ALREADY_CLAIMED", 409);
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
  void addTakenUsername(provision.username);
  const subscription = await createUserPanelSubscription({
    userRowId: user.id,
    panelId: Number(chosenPanel.id),
    serviceType: PanelServiceType.TRIAL,
    clientUsername: provision.username,
    panelAdminId: provision.adminId,
    panelUrl: provision.panelUrl,
    paymentMethod: "trial",
  });

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

export async function activatePanelUsage(telegramUserId, rawUsername) {
  const user = await getUserByTelegramId(telegramUserId);
  if (!user) {
    throw new PanelServiceError("کاربر یافت نشد", "USER_NOT_FOUND", 404);
  }

  const existingUsage = await findUserPanelSubscription(user.id, PanelServiceType.USAGE);
  if (existingUsage) {
    throw new PanelServiceError("پنل مصرفی قبلاً فعال شده است", "USAGE_ALREADY_ACTIVE", 409);
  }

  const minBalanceIrt = getPanelUsageMinimumBalanceIrt();
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
  let provision;
  let chosenPanel;

  if (trial) {
    const trialPanel = await findPasarGuardPanelById(trial.panelId, { includePassword: true });
    chosenPanel = trialPanel?.isActive && trialPanel?.salesEnabled ? trialPanel : candidatePanels[0];
    provision = await upgradeTrialAdminToPanelUsage(chosenPanel, {
      username: trial.clientUsername,
      telegramUserId,
    });
    await updateUserPanelSubscription(Number(trial.id), {
      serviceType: PanelServiceType.USAGE,
      panelId: Number(chosenPanel.id),
      panelUrl: provision.panelUrl,
      panelAdminId: provision.adminId,
      paymentMethod: "wallet",
      status: "active",
    });
    const subscription = await findUserPanelSubscription(user.id, PanelServiceType.USAGE);
    return {
      subscription,
      credentials: {
        username: provision.username,
        password: user.panelAdminPassword || null,
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
  void addTakenUsername(provision.username);
  const subscription = await createUserPanelSubscription({
    userRowId: user.id,
    panelId: Number(chosenPanel.id),
    serviceType: PanelServiceType.USAGE,
    clientUsername: provision.username,
    panelAdminId: provision.adminId,
    panelUrl: provision.panelUrl,
    paymentMethod: "wallet",
  });

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
