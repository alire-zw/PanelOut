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
import { outboundUsageLowBalanceKeyboard } from "../keyboards/outbound-usage-low-balance.keyboard.js";
import {
  buildOutboundUsageLowBalance10GbMessage,
  buildOutboundUsageLowBalance5GbMessage,
  buildOutboundUsageSuspendedMessage,
} from "../messages/outbound-usage-low-balance.message.js";
import {
  buildOutboundUsageBillingContext,
  getSubscriptionPricing,
} from "./subscription-pricing.service.js";
import {
  fetchPasarGuardUser,
  getPasarGuardUserUsedTraffic,
  setPasarGuardUserStatus,
} from "./pasarguard-provision.service.js";

const balanceNotificationReset = {
  lowBalanceNotified: false,
  lowBalance5GbNotified: false,
  suspendedNotified: false,
};

const billableOutboundUsageWhere = {
  serviceType: ServiceType.OUTBOUND_USAGE,
  panelStatus: { not: SubscriptionPanelStatus.DEACTIVATED },
};

async function userHasUsageNotificationFlag(userId, field) {
  const count = await prisma.userSubscription.count({
    where: {
      userId: BigInt(userId),
      ...billableOutboundUsageWhere,
      [field]: true,
    },
  });

  return count > 0;
}

async function setUserUsageNotificationFlags(userId, data) {
  await prisma.userSubscription.updateMany({
    where: {
      userId: BigInt(userId),
      ...billableOutboundUsageWhere,
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
      reply_markup: outboundUsageLowBalanceKeyboard(),
      link_preview_options: { is_disabled: true },
    });
  } catch (err) {
    logger.warn("outbound-usage-billing", `balance notify fail ${userId}`, {
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
    await setPasarGuardUserStatus(server, subscription.clientEmail, "disabled");
  } catch (err) {
    logger.error("outbound-usage-billing", "panel suspend fail", {
      subscriptionId: String(subscription.id),
      error: err.message,
    });
    return false;
  }

  await prisma.userSubscription.update({
    where: { id: subscription.id },
    data: { panelStatus: SubscriptionPanelStatus.SUSPENDED },
  });

  logger.info("outbound-usage-billing", "subscription suspended (low balance)", {
    subscriptionId: String(subscription.id),
    userId: String(subscription.userId),
  });

  return true;
}

export async function reactivateSubscriptionOnPanel(subscription, server) {
  if (subscription.panelStatus !== SubscriptionPanelStatus.SUSPENDED) {
    return false;
  }

  await setPasarGuardUserStatus(server, subscription.clientEmail, "active");

  await prisma.userSubscription.update({
    where: { id: subscription.id },
    data: { panelStatus: SubscriptionPanelStatus.ACTIVE },
  });

  logger.info("outbound-usage-billing", "subscription reactivated", {
    subscriptionId: String(subscription.id),
    userId: String(subscription.userId),
  });

  return true;
}

export async function reactivateSuspendedUsageSubscriptions(userId, userBalance) {
  const pricing = await getSubscriptionPricing();
  const billingCtx = buildOutboundUsageBillingContext(pricing);
  const subscriptions = await prisma.userSubscription.findMany({
    where: {
      userId: BigInt(userId),
      serviceType: ServiceType.OUTBOUND_USAGE,
      panelStatus: SubscriptionPanelStatus.SUSPENDED,
    },
    include: { server: true },
  });

  for (const subscription of subscriptions) {
    await reactivateSubscriptionOnPanel(subscription, subscription.server);
  }

  if (userBalance >= billingCtx.lowBalance10GbIrt) {
    await prisma.userSubscription.updateMany({
      where: {
        userId: BigInt(userId),
        serviceType: ServiceType.OUTBOUND_USAGE,
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

      await tx.outboundUsageCharge.create({
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
            ...billableOutboundUsageWhere,
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

  logger.info("outbound-usage-billing", "usage billed", {
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
    await setUserUsageNotificationFlags(userId, balanceNotificationReset);
  } else if (balance > 0n) {
    if (
      balance < billingCtx.lowBalance10GbIrt &&
      !(await userHasUsageNotificationFlag(userId, "lowBalanceNotified"))
    ) {
      await sendBalanceNotification(
        userId,
        buildOutboundUsageLowBalance10GbMessage(balance),
      );
      await setUserUsageNotificationFlags(userId, { lowBalanceNotified: true });
    }

    if (
      balance < billingCtx.lowBalance5GbIrt &&
      !(await userHasUsageNotificationFlag(userId, "lowBalance5GbNotified"))
    ) {
      await sendBalanceNotification(
        userId,
        buildOutboundUsageLowBalance5GbMessage(balance),
      );
      await setUserUsageNotificationFlags(userId, { lowBalance5GbNotified: true });
    }
  }

  const needsSuspend =
    subscription.panelStatus === SubscriptionPanelStatus.ACTIVE &&
    (balance === 0n || billResult?.partial === true);

  let newlySuspended = false;

  if (needsSuspend) {
    newlySuspended = await suspendSubscriptionOnPanel(subscription, server);

    if (!newlySuspended) {
      logger.warn("outbound-usage-billing", "suspend pending retry", {
        subscriptionId: String(subscription.id),
        userId: String(userId),
      });
    }
  }

  if (
    newlySuspended &&
    !(await userHasUsageNotificationFlag(userId, "suspendedNotified"))
  ) {
    await sendBalanceNotification(userId, buildOutboundUsageSuspendedMessage());
    await setUserUsageNotificationFlags(userId, { suspendedNotified: true });
  }
}

async function initializeBillingBaseline(subscription, server) {
  const currentUsed = await getPasarGuardUserUsedTraffic(server, subscription.clientEmail);

  await prisma.userSubscription.update({
    where: { id: subscription.id },
    data: {
      lastBilledTrafficBytes: currentUsed,
      lastBilledAt: new Date(),
    },
  });

  return currentUsed;
}

export async function processOutboundUsageSubscription(subscription) {
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
    const panelUser = await fetchPasarGuardUser(server, subscription.clientEmail);
    currentUsed = BigInt(panelUser?.used_traffic ?? 0);
  } catch (err) {
    if (err.status === 404) {
      logger.warn("outbound-usage-billing", "panel user missing", {
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
  const billingCtx = buildOutboundUsageBillingContext(pricing);
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

export async function runOutboundUsageBillingCycle() {
  const subscriptions = await prisma.userSubscription.findMany({
    where: billableOutboundUsageWhere,
    include: {
      user: true,
      server: true,
    },
  });

  let billed = 0;
  let errors = 0;

  for (const subscription of subscriptions) {
    try {
      const result = await processOutboundUsageSubscription(subscription);
      if (result?.billed) billed += 1;
    } catch (err) {
      errors += 1;
      logger.error("outbound-usage-billing", `sub #${subscription.id} fail`, {
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

export async function runOutboundUsageBillingForUser(userId) {
  const subscriptions = await prisma.userSubscription.findMany({
    where: {
      userId: BigInt(userId),
      ...billableOutboundUsageWhere,
    },
    include: {
      user: true,
      server: true,
    },
  });

  for (const subscription of subscriptions) {
    try {
      await processOutboundUsageSubscription(subscription);
    } catch (err) {
      logger.error("outbound-usage-billing", `user ${userId} sub fail`, {
        error: err.message,
      });
    }
  }
}
