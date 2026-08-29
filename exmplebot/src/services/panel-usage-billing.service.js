import { getBotInstance } from "../bot/instance.js";
import {
  ServiceType,
  SubscriptionPanelStatus,
} from "../constants/service-types.js";
import { prisma } from "../db/prisma.js";
import {
  calculateTrafficBytesForCostIrt,
  calculateUsageCostIrt,
} from "../lib/outbound-usage-billing.js";
import { logger } from "../lib/logger.js";
import { panelUsageLowBalanceKeyboard } from "../keyboards/panel-usage-low-balance.keyboard.js";
import {
  buildPanelUsageLowBalance10GbMessage,
  buildPanelUsageLowBalance5GbMessage,
  buildPanelUsageSuspendedMessage,
} from "../messages/panel-usage-low-balance.message.js";
import {
  activateAllPanelAdminDisabledUsers,
  disableAllPanelAdminActiveUsers,
  getPanelUsageAdminUsedTraffic,
} from "./panel-usage-provision.service.js";
import {
  buildPanelUsageBillingContext,
  getSubscriptionPricing,
} from "./subscription-pricing.service.js";

const balanceNotificationReset = {
  lowBalanceNotified: false,
  lowBalance5GbNotified: false,
  suspendedNotified: false,
};

const billablePanelUsageWhere = {
  serviceType: ServiceType.PANEL_USAGE,
  panelStatus: { not: SubscriptionPanelStatus.DEACTIVATED },
};

async function userHasPanelUsageNotificationFlag(userId, field) {
  const count = await prisma.userSubscription.count({
    where: {
      userId: BigInt(userId),
      ...billablePanelUsageWhere,
      [field]: true,
    },
  });

  return count > 0;
}

async function setUserPanelUsageNotificationFlags(userId, data) {
  await prisma.userSubscription.updateMany({
    where: {
      userId: BigInt(userId),
      ...billablePanelUsageWhere,
    },
    data,
  });
}

async function sendBalanceNotification(userId, text) {
  const bot = getBotInstance();
  if (!bot) return;

  try {
    await bot.api.sendMessage(Number(userId), text, {
      parse_mode: "HTML",
      reply_markup: panelUsageLowBalanceKeyboard(),
      link_preview_options: { is_disabled: true },
    });
  } catch (err) {
    logger.warn("panel-usage-billing", `balance notify fail ${userId}`, {
      error: err.message,
    });
  }
}

async function suspendSubscriptionOnPanel(subscription, server) {
  if (subscription.panelStatus === SubscriptionPanelStatus.SUSPENDED) {
    return false;
  }

  if (subscription.panelStatus === SubscriptionPanelStatus.DEACTIVATED) {
    return false;
  }

  try {
    await disableAllPanelAdminActiveUsers(server, subscription.clientEmail);
  } catch (err) {
    logger.error("panel-usage-billing", "panel suspend fail", {
      subscriptionId: String(subscription.id),
      adminUsername: subscription.clientEmail,
      error: err.message,
    });
    return false;
  }

  await prisma.userSubscription.update({
    where: { id: subscription.id },
    data: { panelStatus: SubscriptionPanelStatus.SUSPENDED },
  });

  logger.info("panel-usage-billing", "admin users disabled (low balance)", {
    subscriptionId: String(subscription.id),
    userId: String(subscription.userId),
    adminUsername: subscription.clientEmail,
  });

  return true;
}

export async function reactivatePanelUsageSubscriptionOnPanel(subscription, server) {
  if (subscription.panelStatus !== SubscriptionPanelStatus.SUSPENDED) {
    return false;
  }

  await activateAllPanelAdminDisabledUsers(server, subscription.clientEmail);

  await prisma.userSubscription.update({
    where: { id: subscription.id },
    data: { panelStatus: SubscriptionPanelStatus.ACTIVE },
  });

  logger.info("panel-usage-billing", "admin users reactivated", {
    subscriptionId: String(subscription.id),
    userId: String(subscription.userId),
    adminUsername: subscription.clientEmail,
  });

  return true;
}

export async function reactivateSuspendedPanelUsageSubscriptions(userId, userBalance) {
  const pricing = await getSubscriptionPricing();
  const billingCtx = buildPanelUsageBillingContext(pricing);
  const subscriptions = await prisma.userSubscription.findMany({
    where: {
      userId: BigInt(userId),
      serviceType: ServiceType.PANEL_USAGE,
      panelStatus: SubscriptionPanelStatus.SUSPENDED,
    },
    include: { server: true },
  });

  for (const subscription of subscriptions) {
    await reactivatePanelUsageSubscriptionOnPanel(subscription, subscription.server);
  }

  if (userBalance >= billingCtx.lowBalance10GbIrt) {
    await prisma.userSubscription.updateMany({
      where: {
        userId: BigInt(userId),
        serviceType: ServiceType.PANEL_USAGE,
        panelStatus: { not: SubscriptionPanelStatus.DEACTIVATED },
      },
      data: balanceNotificationReset,
    });
  }
}

function resolveBillableAmount(balance, delta, pricePerGb) {
  const fullCostIrt = calculateUsageCostIrt(delta, pricePerGb);

  if (fullCostIrt <= 0n) {
    return null;
  }

  if (balance <= 0n) {
    return { chargeAmount: 0n, billedBytes: 0n, fullCostIrt, insufficient: true };
  }

  if (balance >= fullCostIrt) {
    return { chargeAmount: fullCostIrt, billedBytes: delta, fullCostIrt, insufficient: false };
  }

  let billedBytes = calculateTrafficBytesForCostIrt(balance, pricePerGb);
  if (billedBytes > delta) {
    billedBytes = delta;
  }

  if (billedBytes <= 0n) {
    return { chargeAmount: 0n, billedBytes: 0n, fullCostIrt, insufficient: true };
  }

  let chargeAmount = calculateUsageCostIrt(billedBytes, pricePerGb);
  if (chargeAmount > balance) {
    billedBytes = calculateTrafficBytesForCostIrt(balance, pricePerGb);
    if (billedBytes > delta) {
      billedBytes = delta;
    }
    chargeAmount = calculateUsageCostIrt(billedBytes, pricePerGb);
  }

  return {
    chargeAmount,
    billedBytes,
    fullCostIrt,
    insufficient: billedBytes < delta,
  };
}

async function billSubscriptionUsage(subscription, server, user, currentUsed, billingCtx) {
  let lastBilled = subscription.lastBilledTrafficBytes ?? 0n;

  if (currentUsed < lastBilled) {
    await prisma.userSubscription.update({
      where: { id: subscription.id },
      data: {
        lastBilledTrafficBytes: currentUsed,
        lastBilledAt: new Date(),
      },
    });
    lastBilled = currentUsed;
  }

  const delta = currentUsed - lastBilled;
  if (delta <= 0n) {
    return { billed: false, amountIrt: 0n };
  }

  const balance = user.balance ?? 0n;
  const billable = resolveBillableAmount(balance, delta, billingCtx.pricePerGb);

  if (!billable) {
    return { billed: false, amountIrt: 0n };
  }

  if (billable.chargeAmount <= 0n || billable.billedBytes <= 0n) {
    return {
      billed: false,
      amountIrt: billable.fullCostIrt,
      pending: true,
      insufficient: true,
    };
  }

  const newLastBilled = lastBilled + billable.billedBytes;

  try {
    await prisma.$transaction(async (tx) => {
      const freshUser = await tx.user.findUnique({
        where: { userId: user.userId },
      });

      if (!freshUser || freshUser.balance < billable.chargeAmount) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      const balanceAfter = freshUser.balance - billable.chargeAmount;

      await tx.user.update({
        where: { userId: user.userId },
        data: {
          balance: { decrement: billable.chargeAmount },
          dateUpdated: new Date(),
        },
      });

      await tx.panelUsageCharge.create({
        data: {
          subscriptionId: subscription.id,
          userId: user.userId,
          trafficBytes: billable.billedBytes,
          amountIrt: billable.chargeAmount,
          trafficAfterBytes: newLastBilled,
        },
      });

      await tx.userSubscription.update({
        where: { id: subscription.id },
        data: {
          lastBilledTrafficBytes: newLastBilled,
          lastBilledAt: new Date(),
        },
      });

      if (balanceAfter >= billingCtx.lowBalance10GbIrt) {
        await tx.userSubscription.updateMany({
          where: {
            userId: user.userId,
            ...billablePanelUsageWhere,
          },
          data: balanceNotificationReset,
        });
      }
    });
  } catch (err) {
    if (err.message === "INSUFFICIENT_BALANCE") {
      return {
        billed: false,
        amountIrt: billable.fullCostIrt,
        pending: true,
        insufficient: true,
      };
    }

    throw err;
  }

  logger.info("panel-usage-billing", "usage billed", {
    subscriptionId: String(subscription.id),
    userId: String(user.userId),
    delta: billable.billedBytes.toString(),
    costIrt: billable.chargeAmount.toString(),
    partial: billable.insufficient,
  });

  return {
    billed: true,
    amountIrt: billable.chargeAmount,
    partial: billable.insufficient,
    insufficient: billable.insufficient,
  };
}

async function processSubscriptionBalanceState(subscription, server, user, billResult, billingCtx) {
  const balance = user.balance ?? 0n;
  const userId = user.userId;

  if (balance >= billingCtx.lowBalance10GbIrt) {
    await setUserPanelUsageNotificationFlags(userId, balanceNotificationReset);
  } else if (balance > 0n) {
    if (
      balance < billingCtx.lowBalance10GbIrt &&
      !(await userHasPanelUsageNotificationFlag(userId, "lowBalanceNotified"))
    ) {
      await sendBalanceNotification(userId, buildPanelUsageLowBalance10GbMessage(balance));
      await setUserPanelUsageNotificationFlags(userId, { lowBalanceNotified: true });
    }

    if (
      balance < billingCtx.lowBalance5GbIrt &&
      !(await userHasPanelUsageNotificationFlag(userId, "lowBalance5GbNotified"))
    ) {
      await sendBalanceNotification(userId, buildPanelUsageLowBalance5GbMessage(balance));
      await setUserPanelUsageNotificationFlags(userId, { lowBalance5GbNotified: true });
    }
  }

  const needsSuspend =
    subscription.panelStatus === SubscriptionPanelStatus.ACTIVE &&
    (balance === 0n || billResult?.partial === true);

  let newlySuspended = false;

  if (needsSuspend) {
    newlySuspended = await suspendSubscriptionOnPanel(subscription, server);

    if (!newlySuspended) {
      logger.warn("panel-usage-billing", "suspend pending retry", {
        subscriptionId: String(subscription.id),
        userId: String(userId),
        adminUsername: subscription.clientEmail,
      });
    }
  }

  if (
    newlySuspended &&
    !(await userHasPanelUsageNotificationFlag(userId, "suspendedNotified"))
  ) {
    await sendBalanceNotification(userId, buildPanelUsageSuspendedMessage());
    await setUserPanelUsageNotificationFlags(userId, { suspendedNotified: true });
  }
}

async function initializeBillingBaseline(subscription, server) {
  const currentUsed = await getPanelUsageAdminUsedTraffic(server, subscription.clientEmail);

  await prisma.userSubscription.update({
    where: { id: subscription.id },
    data: {
      lastBilledTrafficBytes: currentUsed,
      lastBilledAt: new Date(),
    },
  });

  return currentUsed;
}

export async function processPanelUsageSubscription(subscription) {
  const server = subscription.server;
  const user = subscription.user;

  if (!server || !user) {
    return;
  }

  if (subscription.panelStatus === SubscriptionPanelStatus.DEACTIVATED) {
    return { billed: false, skipped: true };
  }

  const balance = user.balance ?? 0n;

  if (
    subscription.panelStatus === SubscriptionPanelStatus.SUSPENDED &&
    balance === 0n
  ) {
    return { billed: false, skipped: true };
  }

  let currentUsed;

  try {
    currentUsed = await getPanelUsageAdminUsedTraffic(server, subscription.clientEmail);
  } catch (err) {
    if (err.status === 404) {
      logger.warn("panel-usage-billing", "panel admin missing", {
        subscriptionId: String(subscription.id),
        clientEmail: subscription.clientEmail,
      });
      return;
    }

    throw err;
  }

  if (subscription.lastBilledAt == null) {
    currentUsed = await initializeBillingBaseline(subscription, server);
  }

  const pricing = await getSubscriptionPricing();
  const billingCtx = buildPanelUsageBillingContext(pricing);
  const billResult = await billSubscriptionUsage(
    subscription,
    server,
    user,
    currentUsed,
    billingCtx,
  );

  const refreshedUser = await prisma.user.findUnique({
    where: { userId: user.userId },
  });

  const refreshedSubscription = await prisma.userSubscription.findUnique({
    where: { id: subscription.id },
  });

  await processSubscriptionBalanceState(
    refreshedSubscription,
    server,
    refreshedUser ?? user,
    billResult,
    billingCtx,
  );

  return billResult;
}

export async function runPanelUsageBillingCycle() {
  const subscriptions = await prisma.userSubscription.findMany({
    where: billablePanelUsageWhere,
    include: {
      user: true,
      server: true,
    },
  });

  let billed = 0;
  let errors = 0;

  for (const subscription of subscriptions) {
    try {
      const result = await processPanelUsageSubscription(subscription);
      if (result?.billed) billed += 1;
    } catch (err) {
      errors += 1;
      logger.error("panel-usage-billing", `sub #${subscription.id} fail`, {
        error: err.message,
      });
    }
  }

  return {
    total: subscriptions.length,
    billed,
    errors,
  };
}

export async function runPanelUsageBillingForUser(userId) {
  const subscriptions = await prisma.userSubscription.findMany({
    where: {
      userId: BigInt(userId),
      ...billablePanelUsageWhere,
    },
    include: {
      user: true,
      server: true,
    },
  });

  for (const subscription of subscriptions) {
    try {
      await processPanelUsageSubscription(subscription);
    } catch (err) {
      logger.error("panel-usage-billing", `user ${userId} sub fail`, {
        error: err.message,
      });
    }
  }
}
