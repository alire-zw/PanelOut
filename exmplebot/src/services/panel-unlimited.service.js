import { PANEL_UNLIMITED_SERVER_ID, ServiceType } from "../constants/service-types.js";
import { normalizePanelTrialError } from "../lib/panel-trial-error.js";
import { logger } from "../lib/logger.js";
import {
  panelUnlimitedPromptKeyboard,
  panelUnlimitedSuccessKeyboard,
} from "../keyboards/panel-unlimited.keyboard.js";
import {
  buildPanelUnlimitedFailedMessage,
  buildPanelUnlimitedSuccessMessage,
  buildPanelUnlimitedUnavailableMessage,
  buildPanelUnlimitedUsernamePromptMessage,
  panelUnlimitedProcessingMessage,
} from "../messages/panel-unlimited.message.js";
import {
  createPanelUnlimitedAdmin,
  upgradePanelUnlimitedAdmin,
} from "./panel-unlimited-provision.service.js";
import { reservePanelUnlimitedSlots } from "./panel-settings.service.js";
import { findServerById, isServerActive, isServerPanelUnlimitedEnabled } from "./server.service.js";
import { buildPasarGuardBaseUrl } from "./pasarguard.service.js";
import { savePanelUnlimitedSubscription } from "./user-subscription.service.js";
import {
  getUserPanelUnlimitedAdmin,
  savePanelUnlimitedAdminCredentials,
  updatePanelUnlimitedMaxUsersLock,
} from "./user.service.js";

export async function getPanelUnlimitedServer() {
  const resolved = await resolvePanelUnlimitedServer();
  return resolved.server;
}

function buildUnavailableResult({ reason, isAdmin = false }) {
  return {
    text: buildPanelUnlimitedUnavailableMessage({
      reason,
      serverId: PANEL_UNLIMITED_SERVER_ID,
      isAdmin,
    }),
    keyboard: panelUnlimitedPromptKeyboard(),
  };
}

export async function resolvePanelUnlimitedServer({ isAdmin = false } = {}) {
  const serverId = PANEL_UNLIMITED_SERVER_ID;
  const server = await findServerById(serverId);

  if (!server) {
    const reason = "سرور در دیتابیس پیدا نشد";
    logger.warn("panel-unlimited", reason, { serverId: String(serverId) });
    return { server: null, reason, result: buildUnavailableResult({ reason, isAdmin }) };
  }

  if (!isServerActive(server)) {
    const reason = `سرور غیرفعال است (isActive=${server.isActive})`;
    logger.warn("panel-unlimited", reason, {
      serverId: String(server.id),
      serverName: server.serverName,
    });
    return { server: null, reason, result: buildUnavailableResult({ reason, isAdmin }) };
  }

  if (!isServerPanelUnlimitedEnabled(server)) {
    const reason = `فروش نامحدود روی سرور خاموش است (panelUnlimitedEnabled=${server.panelUnlimitedEnabled})`;
    logger.warn("panel-unlimited", reason, {
      serverId: String(server.id),
      serverName: server.serverName,
    });
    return { server: null, reason, result: buildUnavailableResult({ reason, isAdmin }) };
  }

  logger.info("panel-unlimited", "server resolved", {
    serverId: String(server.id),
    serverName: server.serverName,
    domain: server.serverDomain || server.serverIp,
  });

  return { server, reason: null, result: null };
}

export function buildPanelUnlimitedUsernamePromptScreen({ count, maxUsers, days }) {
  return {
    text: buildPanelUnlimitedUsernamePromptMessage({ count, maxUsers, days }),
    keyboard: panelUnlimitedPromptKeyboard(),
  };
}

export function buildPanelUnlimitedProcessingScreen() {
  return {
    text: panelUnlimitedProcessingMessage,
    keyboard: panelUnlimitedPromptKeyboard(),
  };
}

async function finalizePanelUnlimitedPurchase(from, purchase, provision, { isUpgrade = false } = {}) {
  await reservePanelUnlimitedSlots(purchase.count);

  if (!isUpgrade) {
    await savePanelUnlimitedAdminCredentials(from.id, {
      username: provision.username,
      password: provision.password,
      roleId: provision.roleId,
      maxUsers: purchase.maxUsers,
    });
  } else {
    await updatePanelUnlimitedMaxUsersLock(from.id, purchase.maxUsers);
  }

  await savePanelUnlimitedSubscription(
    {
      userId: from.id,
      serverId: provision.serverId,
      serviceType: ServiceType.PANEL_UNLIMITED,
      volumeGb: purchase.count,
      connectionLink: provision.panelUrl,
      panelSubId: provision.adminId != null ? String(provision.adminId) : null,
      clientEmail: provision.username,
      remark: `${purchase.maxUsers}|${purchase.days}`,
      paymentMethod: "pending",
    },
    { isUpgrade },
  );
}

export async function handlePanelUnlimitedUsername(from, username, purchase, { isAdmin = false } = {}) {
  const resolved = await resolvePanelUnlimitedServer({ isAdmin });

  if (!resolved.server) {
    return resolved.result;
  }

  const server = resolved.server;

  let provision;

  try {
    provision = await createPanelUnlimitedAdmin(server, {
      username,
      telegramUserId: from.id,
      subscriptionCount: purchase.count,
      maxUsersPerSub: purchase.maxUsers,
      days: purchase.days,
    });
  } catch (err) {
    const normalized = normalizePanelTrialError(err);

    logger.error("panel-unlimited", "provision flow failed", {
      userId: String(from.id),
      username,
      serverId: String(server.id),
      code: err.code || normalized.code,
      status: err.status ?? normalized.status,
      error: normalized.message,
    });

    return {
      text: buildPanelUnlimitedFailedMessage(normalized, { isAdmin }),
      keyboard: panelUnlimitedPromptKeyboard(),
      retryUsername:
        normalized.code === "USERNAME_TAKEN" || normalized.code === "CONFLICT",
    };
  }

  try {
    await finalizePanelUnlimitedPurchase(from, purchase, {
      ...provision,
      serverId: server.id,
    });
  } catch (err) {
    logger.error("panel-unlimited", "subscription save failed after admin created", {
      userId: String(from.id),
      username: provision.username,
      serverId: String(server.id),
      error: err.message,
    });

    const normalized = normalizePanelTrialError(err);

    return {
      text: buildPanelUnlimitedFailedMessage(
        {
          code: "DB_SAVE_FAILED",
          status: null,
          message: normalized.message,
        },
        { isAdmin },
      ),
      keyboard: panelUnlimitedPromptKeyboard(),
    };
  }

  return {
    text: buildPanelUnlimitedSuccessMessage(),
    keyboard: panelUnlimitedSuccessKeyboard({
      username: provision.username,
      password: provision.password,
      panelUrl: provision.panelUrl,
      count: purchase.count,
      maxUsers: purchase.maxUsers,
      days: purchase.days,
    }),
  };
}

export async function handlePanelUnlimitedRepeatPurchase(from, purchase, { isAdmin = false } = {}) {
  const existing = await getUserPanelUnlimitedAdmin(from.id);

  if (!existing?.username) {
    return {
      text: buildPanelUnlimitedUsernamePromptMessage(purchase),
      keyboard: panelUnlimitedPromptKeyboard(),
      needsUsername: true,
    };
  }

  const resolved = await resolvePanelUnlimitedServer({ isAdmin });

  if (!resolved.server) {
    return resolved.result;
  }

  const server = resolved.server;

  try {
    await upgradePanelUnlimitedAdmin(server, {
      username: existing.username,
      additionalSubscriptionCount: purchase.count,
      maxUsersPerSub: purchase.maxUsers,
      days: purchase.days,
    });
  } catch (err) {
    const normalized = normalizePanelTrialError(err);

    logger.error("panel-unlimited", "repeat purchase upgrade failed", {
      userId: String(from.id),
      roleId: String(existing.roleId),
      code: err.code || normalized.code,
      error: normalized.message,
    });

    return {
      text: buildPanelUnlimitedFailedMessage(normalized, { isAdmin }),
      keyboard: panelUnlimitedPromptKeyboard(),
    };
  }

  try {
    await finalizePanelUnlimitedPurchase(
      from,
      purchase,
      {
        username: existing.username,
        password: existing.password,
        panelUrl: `${buildPasarGuardBaseUrl(server)}/dashboard`,
        roleId: existing.roleId,
        serverId: server.id,
      },
      { isUpgrade: true },
    );
  } catch (err) {
    logger.error("panel-unlimited", "repeat purchase save failed", {
      userId: String(from.id),
      error: err.message,
    });

    return {
      text: buildPanelUnlimitedFailedMessage(
        { code: "DB_SAVE_FAILED", status: null, message: err.message },
        { isAdmin },
      ),
      keyboard: panelUnlimitedPromptKeyboard(),
    };
  }

  return {
    text: buildPanelUnlimitedSuccessMessage({ isUpgrade: true }),
    keyboard: panelUnlimitedSuccessKeyboard({
      username: existing.username,
      password: existing.password,
      panelUrl: `${buildPasarGuardBaseUrl(server)}/dashboard`,
      count: purchase.count,
      maxUsers: purchase.maxUsers,
      days: purchase.days,
    }),
  };
}
