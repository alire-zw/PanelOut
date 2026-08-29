import {
  PANEL_USAGE_MIN_BALANCE_GB,
  PANEL_USAGE_SERVER_ID,
  ServiceType,
  SubscriptionPanelStatus,
} from "../constants/service-types.js";
import { panelUsageActivationKeyboard, panelUsageActiveServiceKeyboard, panelUsageInsufficientBalanceKeyboard } from "../keyboards/panel-usage-activation.keyboard.js";
import {
  buildPanelUsageActivationMessage,
  buildPanelUsageActiveServiceMessage,
  buildPanelUsageInsufficientBalanceMessage,
  buildPanelUsageUsernamePromptMessage,
  buildPanelUsageFailedMessage,
  buildPanelUsageSuccessMessage,
  buildPanelUsageUpgradedFromTrialMessage,
  panelUsageProcessingMessage,
  panelUsageUnavailableMessage,
} from "../messages/panel-usage.message.js";
import { formatTrafficGb } from "../lib/traffic-format.js";
import { formatToman } from "../messages/wallet.message.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../db/prisma.js";
import {
  createPanelUsageAdmin,
  fetchPanelUsageAdmin,
  getPanelUsageAdminUsedTraffic,
  upgradeTrialAdminToPanelUsage,
} from "./panel-usage-provision.service.js";
import {
  findServerById,
  isServerActive,
  isServerPanelUsageEnabled,
  isServerSalesEnabled,
} from "./server.service.js";
import {
  findSubscriptionByClientEmailAndServer,
  findUserPanelTrialSubscription,
  findUserPanelUsageSubscription,
} from "./user-subscription.service.js";
import { getUserByTelegramId, savePanelUsageAdminPassword, syncUserFromTelegram } from "./user.service.js";
import { buildPasarGuardBaseUrl } from "./pasarguard.service.js";
import { buildPanelClientComment } from "./pasarguard-provision.service.js";
import { panelUsagePromptKeyboard, panelUsageSuccessKeyboard } from "../keyboards/panel-usage.keyboard.js";
import {
  getPanelUsageMinimumBalanceIrtFromPricing,
  getSubscriptionPricing,
} from "./subscription-pricing.service.js";

export async function getPanelUsageMinimumBalanceIrt() {
  const pricing = await getSubscriptionPricing();
  return getPanelUsageMinimumBalanceIrtFromPricing(pricing);
}

export async function getPanelUsageServer() {
  const server = await findServerById(PANEL_USAGE_SERVER_ID);

  if (
    !server ||
    !isServerActive(server) ||
    !isServerSalesEnabled(server) ||
    !isServerPanelUsageEnabled(server)
  ) {
    return null;
  }

  return server;
}

function buildPanelUsageActiveKeyboard({ existing, user, usedGb }) {
  const statusLabel =
    existing.panelStatus === SubscriptionPanelStatus.SUSPENDED
      ? "تعلیق"
      : "فعال";

  return panelUsageActiveServiceKeyboard({
    username: existing.clientEmail,
    password: user?.panelUsageAdminPassword ?? null,
    panelUrl:
      existing.connectionLink ||
      `${buildPasarGuardBaseUrl(existing.server)}/dashboard`,
    usedLabel: `${usedGb} گیگابایت`,
    statusLabel,
  });
}

export async function buildPanelUsageActivationScreen(from) {
  await syncUserFromTelegram(from);

  const user = await getUserByTelegramId(from.id);
  const balance = user?.balance ?? 0n;
  const existing = await findUserPanelUsageSubscription(from.id);
  const trial = await findUserPanelTrialSubscription(from.id);
  const minBalanceIrt = await getPanelUsageMinimumBalanceIrt();

  if (existing) {
    const usedGb = await getPanelUsageUsedGb(existing);

    return {
      text: buildPanelUsageActiveServiceMessage({
        panelStatus: existing.panelStatus,
      }),
      keyboard: buildPanelUsageActiveKeyboard({ existing, user, usedGb }),
    };
  }

  return {
    text: buildPanelUsageActivationMessage({
      balance,
      minBalanceIrt,
      minBalanceGb: PANEL_USAGE_MIN_BALANCE_GB,
      hasTrial: Boolean(trial),
      trialUsername: trial?.clientEmail ?? null,
    }),
    keyboard: panelUsageActivationKeyboard(),
  };
}

async function getPanelUsageUsedGb(subscription) {
  try {
    const used = await getPanelUsageAdminUsedTraffic(
      subscription.server,
      subscription.clientEmail,
    );
    return formatTrafficGb(used);
  } catch {
    return formatTrafficGb(subscription.lastBilledTrafficBytes ?? 0n);
  }
}

export function buildPanelUsageProcessingScreen() {
  return {
    text: panelUsageProcessingMessage,
    keyboard: panelUsagePromptKeyboard(),
  };
}

export function buildPanelUsageUsernamePromptScreen() {
  return {
    text: buildPanelUsageUsernamePromptMessage(),
    keyboard: panelUsagePromptKeyboard(),
  };
}

export async function handlePanelUsageConfirmStart(from) {
  await syncUserFromTelegram(from);

  const existing = await findUserPanelUsageSubscription(from.id);

  if (existing) {
    return {
      ok: false,
      alreadyActive: true,
      screen: await buildPanelUsageActivationScreen(from),
    };
  }

  const user = await getUserByTelegramId(from.id);
  const balance = user?.balance ?? 0n;
  const minBalanceIrt = await getPanelUsageMinimumBalanceIrt();

  if (balance < minBalanceIrt) {
    return {
      ok: false,
      text: buildPanelUsageInsufficientBalanceMessage({
        balance,
        minBalanceIrt,
        minBalanceGb: PANEL_USAGE_MIN_BALANCE_GB,
      }),
      keyboard: panelUsageInsufficientBalanceKeyboard(),
    };
  }

  const server = await getPanelUsageServer();

  if (!server) {
    return {
      ok: false,
      text: panelUsageUnavailableMessage,
      keyboard: panelUsagePromptKeyboard(),
    };
  }

  const trial = await findUserPanelTrialSubscription(from.id);

  if (trial) {
    return {
      ok: true,
      upgradeFromTrial: true,
    };
  }

  return {
    ok: true,
    screen: buildPanelUsageUsernamePromptScreen(),
  };
}

export async function handlePanelUsageUpgradeFromTrial(from, { isAdmin = false } = {}) {
  const trial = await findUserPanelTrialSubscription(from.id);

  if (!trial) {
    return buildPanelUsageUsernamePromptScreen();
  }

  const existing = await findUserPanelUsageSubscription(from.id);

  if (existing) {
    return buildPanelUsageActivationScreen(from);
  }

  const user = await getUserByTelegramId(from.id);
  const balance = user?.balance ?? 0n;
  const minBalanceIrt = await getPanelUsageMinimumBalanceIrt();

  if (balance < minBalanceIrt) {
    return {
      text: buildPanelUsageInsufficientBalanceMessage({
        balance,
        minBalanceIrt,
        minBalanceGb: PANEL_USAGE_MIN_BALANCE_GB,
      }),
      keyboard: panelUsageInsufficientBalanceKeyboard(),
    };
  }

  const server = await getPanelUsageServer();

  if (!server) {
    return {
      text: panelUsageUnavailableMessage,
      keyboard: panelUsagePromptKeyboard(),
    };
  }

  const apiUsername = String(trial.clientEmail || "").trim().toLowerCase();
  let provision;

  try {
    provision = await upgradeTrialAdminToPanelUsage(server, {
      username: apiUsername,
      telegramUserId: from.id,
    });
  } catch (err) {
    logger.error("panel-usage", "trial upgrade failed", {
      userId: String(from.id),
      username: apiUsername,
      code: err.code,
      error: err.message,
    });

    return {
      text: buildPanelUsageFailedMessage(
        { code: err.code, message: err.message },
        { isAdmin },
      ),
      keyboard: panelUsagePromptKeyboard(),
    };
  }

  try {
    await prisma.userSubscription.update({
      where: { id: trial.id },
      data: {
        serviceType: ServiceType.PANEL_USAGE,
        volumeGb: 0,
        connectionLink: provision.panelUrl,
        panelSubId: provision.adminId != null ? String(provision.adminId) : trial.panelSubId,
        paymentMethod: "wallet",
        panelStatus: SubscriptionPanelStatus.ACTIVE,
        lastBilledTrafficBytes: provision.usedTraffic,
        lastBilledAt: new Date(),
      },
    });
  } catch (err) {
    logger.error("panel-usage", "trial upgrade subscription update failed", {
      userId: String(from.id),
      username: apiUsername,
      error: err.message,
    });

    return {
      text: buildPanelUsageFailedMessage(
        { code: "DB_SAVE_FAILED", message: err.message },
        { isAdmin },
      ),
      keyboard: panelUsagePromptKeyboard(),
    };
  }

  const password = user?.panelUsageAdminPassword ?? null;

  logger.info("panel-usage", "trial upgraded to usage", {
    userId: String(from.id),
    username: provision.username,
    serverId: String(server.id),
  });

  return {
    text: buildPanelUsageUpgradedFromTrialMessage(),
    keyboard: panelUsageSuccessKeyboard({
      username: provision.username,
      password,
      panelUrl: provision.panelUrl,
    }),
  };
}

async function createPanelUsageSubscription({ userId, server, provision }) {
  return prisma.userSubscription.create({
    data: {
      userId: BigInt(userId),
      serverId: server.id,
      serviceType: ServiceType.PANEL_USAGE,
      volumeGb: 0,
      connectionLink: provision.panelUrl,
      panelSubId: provision.adminId != null ? String(provision.adminId) : null,
      clientEmail: provision.username,
      remark: provision.username,
      paymentMethod: "wallet",
      panelStatus: SubscriptionPanelStatus.ACTIVE,
      lastBilledTrafficBytes: provision.usedTraffic ?? 0n,
      lastBilledAt: new Date(),
    },
  });
}

function adminNoteMatchesUser(note, telegramUserId) {
  return String(note || "").includes(buildPanelClientComment(telegramUserId));
}

async function recoverOrphanedPanelUsageAdmin(server, from, username) {
  const apiUsername = String(username || "").trim().toLowerCase();
  const existingForUser = await findUserPanelUsageSubscription(from.id);

  if (existingForUser) {
    return buildPanelUsageActivationScreen(from);
  }

  const existingOnServer = await findSubscriptionByClientEmailAndServer(
    apiUsername,
    server.id,
  );

  if (existingOnServer) {
    if (existingOnServer.userId === BigInt(from.id)) {
      return buildPanelUsageActivationScreen(from);
    }

    return null;
  }

  let admin;

  try {
    admin = await fetchPanelUsageAdmin(server, apiUsername);
  } catch {
    return null;
  }

  if (!adminNoteMatchesUser(admin?.note, from.id)) {
    return null;
  }

  const user = await getUserByTelegramId(from.id);
  const panelUrl = `${buildPasarGuardBaseUrl(server)}/dashboard`;
  const provision = {
    username: admin?.username || apiUsername,
    password: user?.panelUsageAdminPassword ?? null,
    panelUrl,
    adminId: admin?.id ?? null,
    usedTraffic: BigInt(admin?.used_traffic ?? 0),
  };

  await createPanelUsageSubscription({
    userId: from.id,
    server,
    provision,
  });

  logger.info("panel-usage", "recovered orphaned admin subscription", {
    userId: String(from.id),
    username: provision.username,
    serverId: String(server.id),
  });

  if (provision.password) {
    return {
      text: buildPanelUsageSuccessMessage(),
      keyboard: panelUsageSuccessKeyboard({
        username: provision.username,
        password: provision.password,
        panelUrl: provision.panelUrl,
      }),
    };
  }

  return {
    text: [
      buildPanelUsageSuccessMessage(),
      "",
      "اکانت ادمین شما قبلاً روی پنل ساخته شده بود و اشتراک در ربات تکمیل شد.",
      "اگر رمز عبور را ندارید، از پشتیبانی راهنمایی بگیرید.",
    ].join("\n"),
    keyboard: panelUsageSuccessKeyboard({
      username: provision.username,
      password: null,
      panelUrl: provision.panelUrl,
    }),
  };
}

export async function handlePanelUsageUsername(from, username, { isAdmin = false } = {}) {
  const existing = await findUserPanelUsageSubscription(from.id);

  if (existing) {
    return buildPanelUsageActivationScreen(from);
  }

  const trial = await findUserPanelTrialSubscription(from.id);
  const apiUsername = String(username || "").trim().toLowerCase();

  if (trial && trial.clientEmail === apiUsername) {
    return handlePanelUsageUpgradeFromTrial(from, { isAdmin });
  }

  const user = await getUserByTelegramId(from.id);
  const balance = user?.balance ?? 0n;
  const minBalanceIrt = await getPanelUsageMinimumBalanceIrt();

  if (balance < minBalanceIrt) {
    return {
      text: buildPanelUsageInsufficientBalanceMessage({
        balance,
        minBalanceIrt,
        minBalanceGb: PANEL_USAGE_MIN_BALANCE_GB,
      }),
      keyboard: panelUsageInsufficientBalanceKeyboard(),
    };
  }

  const server = await getPanelUsageServer();

  if (!server) {
    return {
      text: panelUsageUnavailableMessage,
      keyboard: panelUsagePromptKeyboard(),
    };
  }

  let provision;

  try {
    provision = await createPanelUsageAdmin(server, {
      username,
      telegramUserId: from.id,
    });
  } catch (err) {
    const recovered = await recoverOrphanedPanelUsageAdmin(server, from, username);

    if (recovered) {
      return recovered;
    }

    const isUsernameTaken =
      err.code === "USERNAME_TAKEN" ||
      err.message === "USERNAME_TAKEN";
    const isNetworkError = /fetch failed|network|timed out|timeout|econnreset|enotfound/i.test(
      String(err.message || ""),
    );

    logger.error("panel-usage", "provision failed", {
      userId: String(from.id),
      username,
      code: err.code,
      error: err.message,
    });

    return {
      text: buildPanelUsageFailedMessage(
        { code: err.code, message: err.message },
        { isAdmin },
      ),
      keyboard: panelUsagePromptKeyboard(),
      retryUsername: isUsernameTaken || isNetworkError,
    };
  }

  try {
    await createPanelUsageSubscription({
      userId: from.id,
      server,
      provision,
    });

    await savePanelUsageAdminPassword(from.id, provision.password);
  } catch (err) {
    const recovered = await recoverOrphanedPanelUsageAdmin(server, from, username);

    if (recovered) {
      return recovered;
    }

    logger.error("panel-usage", "subscription save failed", {
      userId: String(from.id),
      username: provision.username,
      error: err.message,
    });

    return {
      text: buildPanelUsageFailedMessage(
        { code: "DB_SAVE_FAILED", message: err.message },
        { isAdmin },
      ),
      keyboard: panelUsagePromptKeyboard(),
    };
  }

  logger.info("panel-usage", "admin account activated", {
    userId: String(from.id),
    username: provision.username,
    serverId: String(server.id),
  });

  return {
    text: buildPanelUsageSuccessMessage(),
    keyboard: panelUsageSuccessKeyboard({
      username: provision.username,
      password: provision.password,
      panelUrl: provision.panelUrl,
    }),
  };
}
