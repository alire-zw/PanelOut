import {
  findUserByTelegramId,
  isStaffRole,
  isSupervisorRole,
  setUserBanned,
  setUserBalance,
  setUserRole,
  toPublicUser,
} from "../db/users.js";
import {
  findUserPanelSubscriptionById,
  listUserPanelSubscriptions,
  updateUserPanelSubscription,
} from "../db/userPanelSubscriptions.js";
import { findPasarGuardPanelById } from "../db/pasarguardPanels.js";
import { buildWalletTransactionsPayload } from "../db/walletTransactions.js";
import { listAdminAuditForUser } from "../lib/audit.js";
import {
  activateAllPanelAdminDisabledUsers,
  disableAllPanelAdminActiveUsers,
} from "../lib/panelProvision.js";
import { log } from "../lib/logger.js";

const PANEL_STATUSES = new Set(["active", "suspended", "deactivated"]);

function assertCanModifyUser(actor, targetUser) {
  if (Number(actor.telegramId) === Number(targetUser.telegramId)) {
    throw Object.assign(new Error("نمی‌توانید حساب خود را از اینجا ویرایش کنید"), {
      status: 400,
    });
  }

  if (isStaffRole(targetUser.role) && !isSupervisorRole(actor.role)) {
    throw Object.assign(new Error("فقط سوپروایزر می‌تواند کاربران staff را ویرایش کند"), {
      status: 403,
    });
  }
}

function toAdminPanel(sub, userPanelAdminPassword = null) {
  return {
    id: sub.id,
    panelId: sub.panelId,
    serviceType: sub.serviceType,
    clientUsername: sub.clientUsername,
    adminPassword: sub.adminPassword || userPanelAdminPassword || null,
    panelAdminId: sub.panelAdminId,
    panelUrl: sub.panelUrl,
    status: sub.status,
    paymentMethod: sub.paymentMethod,
    walletBalance: sub.walletBalance,
    lastBilledTrafficBytes: sub.lastBilledTrafficBytes,
    prepaidTrafficBytes: sub.prepaidTrafficBytes,
    lastBilledAt: sub.lastBilledAt,
    createdAt: sub.createdAt,
    updatedAt: sub.updatedAt,
  };
}

async function loadTargetUser(telegramId) {
  const row = await findUserByTelegramId(telegramId);
  if (!row) {
    throw Object.assign(new Error("کاربر یافت نشد"), { status: 404 });
  }
  return toPublicUser(row);
}

export async function getAdminUserDetail(telegramId) {
  const row = await findUserByTelegramId(telegramId);
  if (!row) {
    throw Object.assign(new Error("کاربر یافت نشد"), { status: 404 });
  }

  const user = {
    ...toPublicUser(row),
    panelAdminPassword: row.panel_admin_password ?? null,
  };
  const accountPassword = row.panel_admin_password ?? null;

  const [panels, txPayload, auditLogs] = await Promise.all([
    listUserPanelSubscriptions(row.id),
    buildWalletTransactionsPayload(telegramId),
    listAdminAuditForUser(telegramId, { limit: 50 }),
  ]);

  return {
    user,
    panels: panels.map((panel) => toAdminPanel(panel, accountPassword)),
    transactions: txPayload.items,
    auditLogs,
  };
}

export async function adminSetUserBanned(actor, telegramId, isBanned) {
  const targetUser = await loadTargetUser(telegramId);
  assertCanModifyUser(actor, targetUser);

  const user = await setUserBanned(telegramId, isBanned);
  return { user, previousBanned: targetUser.isBanned };
}

export async function adminSetUserBalance(actor, telegramId, balanceToman, note = null) {
  const targetUser = await loadTargetUser(telegramId);
  assertCanModifyUser(actor, targetUser);

  const result = await setUserBalance(telegramId, balanceToman);
  return {
    user: result.user,
    previousBalance: result.previousBalance,
    newBalance: result.newBalance,
    note: typeof note === "string" ? note.trim() || null : null,
  };
}

export async function adminSetUserRole(actor, telegramId, roleApi) {
  if (!isSupervisorRole(actor.role)) {
    throw Object.assign(new Error("فقط سوپروایزر می‌تواند نقش کاربران را تغییر دهد"), {
      status: 403,
    });
  }

  const targetUser = await loadTargetUser(telegramId);
  if (Number(actor.telegramId) === Number(targetUser.telegramId)) {
    throw Object.assign(new Error("نمی‌توانید نقش خود را تغییر دهید"), { status: 400 });
  }

  const normalized = String(roleApi || "").trim().toLowerCase();
  if (!["user", "admin", "supervisor"].includes(normalized)) {
    throw Object.assign(new Error("نقش نامعتبر است"), { status: 400 });
  }

  if (targetUser.role === normalized) {
    return {
      user: targetUser,
      previousRole: targetUser.role,
      newRole: normalized,
    };
  }

  const user = await setUserRole(telegramId, normalized);
  return {
    user,
    previousRole: targetUser.role,
    newRole: normalized,
  };
}

async function applyPanelRemoteStatus(panel, username, status, previousStatus) {
  if (status === previousStatus) return;

  if (status === "active") {
    if (previousStatus === "suspended" || previousStatus === "deactivated") {
      await activateAllPanelAdminDisabledUsers(panel, username);
    }
    return;
  }

  if (status === "suspended" || status === "deactivated") {
    if (previousStatus === "active") {
      await disableAllPanelAdminActiveUsers(panel, username);
    }
  }
}

export async function adminSetUserPanelStatus(actor, telegramId, subscriptionId, status) {
  const normalizedStatus = String(status || "").trim();
  if (!PANEL_STATUSES.has(normalizedStatus)) {
    throw Object.assign(new Error("وضعیت پنل نامعتبر است"), { status: 400 });
  }

  const targetUser = await loadTargetUser(telegramId);
  assertCanModifyUser(actor, targetUser);

  const row = await findUserByTelegramId(telegramId);
  const subscription = await findUserPanelSubscriptionById(subscriptionId, row.id);
  if (!subscription) {
    throw Object.assign(new Error("پنل کاربر یافت نشد"), { status: 404 });
  }

  const previousStatus = subscription.status;
  const accountPassword = row.panel_admin_password ?? null;

  if (previousStatus === normalizedStatus) {
    return {
      panel: toAdminPanel(subscription, accountPassword),
      previousStatus,
      newStatus: normalizedStatus,
    };
  }

  const panel = await findPasarGuardPanelById(subscription.panelId, {
    includePassword: true,
  });

  try {
    await applyPanelRemoteStatus(
      panel,
      subscription.clientUsername,
      normalizedStatus,
      previousStatus,
    );
  } catch (err) {
    log.error(
      "admin",
      `panel status change fail sub:${subscription.id} — ${err.message || err}`,
    );
    throw Object.assign(new Error("خطا در تغییر وضعیت پنل روی سرور"), { status: 502 });
  }

  const updated = await updateUserPanelSubscription(subscription.id, {
    status: normalizedStatus,
  });

  return {
    panel: toAdminPanel(updated, accountPassword),
    previousStatus,
    newStatus: normalizedStatus,
  };
}
