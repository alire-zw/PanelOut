import {
  OUTBOUND_USAGE_EXISTING_RESERVE_GB,
  OUTBOUND_USAGE_MIN_BALANCE_GB,
  ServiceType,
  SubscriptionPanelStatus,
} from "../constants/service-types.js";
import { outboundSubscriptionDeliveryKeyboard } from "../keyboards/outbound-subscription-delivery.keyboard.js";
import {
  outboundUsageActivationKeyboard,
  outboundUsageActiveServiceKeyboard,
  outboundUsageDeactivatedKeyboard,
  outboundUsageInsufficientBalanceKeyboard,
} from "../keyboards/outbound-usage-activation.keyboard.js";
import {
  buildOutboundUsageActivationMessage,
  buildOutboundUsageActiveServiceMessage,
  buildOutboundUsageDeactivatedMessage,
  buildOutboundUsageInsufficientBalanceMessage,
} from "../messages/outbound-usage-activation.message.js";
import { buildOutboundVolumeProvisionFailedMessage } from "../messages/outbound-volume-payment.message.js";
import { buildOutboundVolumeWalletProcessingMessage } from "../messages/outbound-volume-payment.message.js";
import { outboundVolumeWalletProcessingKeyboard } from "../keyboards/outbound-volume-payment.keyboard.js";
import { formatTrafficGb } from "../lib/traffic-format.js";
import {
  getOutboundUsageMinimumBalanceIrtFromPricing,
  getSubscriptionPricing,
} from "./subscription-pricing.service.js";
import {
  getPasarGuardUserUsedTraffic,
  provisionOutboundUsageUser,
  setPasarGuardUserStatus,
} from "./pasarguard-provision.service.js";
import {
  buildOutboundSubscriptionDeliveryScreen,
} from "./outbound-subscription-fulfillment.service.js";
import {
  getAllServers,
  isServerActive,
  isServerOutboundUsageEnabled,
  isServerSalesEnabled,
} from "./server.service.js";
import {
  countUserNonDeactivatedOutboundUsageSubscriptions,
  findUserLatestOutboundUsageSubscription,
  findUserOutboundUsageSubscriptionById,
} from "./user-subscription.service.js";
import { getUserByTelegramId, syncUserFromTelegram } from "./user.service.js";
import { prisma } from "../db/prisma.js";
import { logger } from "../lib/logger.js";

export function getOutboundUsageRequiredBalanceGb(existingCount = 0) {
  return (
    OUTBOUND_USAGE_MIN_BALANCE_GB +
    Number(existingCount) * OUTBOUND_USAGE_EXISTING_RESERVE_GB
  );
}

export async function getOutboundUsageMinimumBalanceIrt(existingCount = 0) {
  const pricing = await getSubscriptionPricing();
  return getOutboundUsageMinimumBalanceIrtFromPricing(pricing, existingCount);
}

export async function pickRandomOutboundUsageServer() {
  const servers = await getAllServers();
  const eligible = servers.filter(
    (server) =>
      isServerActive(server) &&
      isServerSalesEnabled(server) &&
      isServerOutboundUsageEnabled(server),
  );

  if (!eligible.length) return null;

  return eligible[Math.floor(Math.random() * eligible.length)];
}

async function getSubscriptionUsedGb(subscription) {
  try {
    const used = await getPasarGuardUserUsedTraffic(
      subscription.server,
      subscription.clientEmail,
    );
    return formatTrafficGb(used);
  } catch {
    return formatTrafficGb(subscription.lastBilledTrafficBytes ?? 0n);
  }
}

function getSubscriptionDisplayName(subscription) {
  return subscription.remark || subscription.clientEmail;
}

export async function buildOutboundUsageActivationScreen(from) {
  await syncUserFromTelegram(from);

  const user = await getUserByTelegramId(from.id);
  const balance = user?.balance ?? 0n;
  const existingCount = await countUserNonDeactivatedOutboundUsageSubscriptions(from.id);
  const existing = await findUserLatestOutboundUsageSubscription(from.id);
  const minBalanceGb = getOutboundUsageRequiredBalanceGb(existingCount);
  const minBalanceIrt = await getOutboundUsageMinimumBalanceIrt(existingCount);

  if (existing) {
    const usedGb = await getSubscriptionUsedGb(existing);

    return {
      text: buildOutboundUsageActiveServiceMessage({
        subscriptionName: getSubscriptionDisplayName(existing),
        usedGb,
        balance,
        minBalanceIrt,
        minBalanceGb,
        existingCount,
      }),
      keyboard: outboundUsageActiveServiceKeyboard(),
    };
  }

  return {
    text: buildOutboundUsageActivationMessage({
      balance,
      minBalanceIrt,
      minBalanceGb,
    }),
    keyboard: outboundUsageActivationKeyboard(),
  };
}

export function buildOutboundUsageProcessingScreen() {
  return {
    text: buildOutboundVolumeWalletProcessingMessage(),
    keyboard: outboundVolumeWalletProcessingKeyboard(),
  };
}

async function createOutboundUsageSubscription({ userId, server, provision }) {
  const initialUsedTraffic = BigInt(provision.user?.used_traffic ?? 0);

  return prisma.userSubscription.create({
    data: {
      userId: BigInt(userId),
      serverId: server.id,
      serviceType: ServiceType.OUTBOUND_USAGE,
      volumeGb: 0,
      groupIds: provision.inboundId,
      connectionLink: provision.subscriptionUrl,
      panelSubId: provision.subId,
      clientEmail: provision.clientEmail,
      remark: provision.remark,
      paymentMethod: "wallet",
      panelStatus: SubscriptionPanelStatus.ACTIVE,
      lastBilledTrafficBytes: initialUsedTraffic,
      lastBilledAt: new Date(),
    },
  });
}

export async function handleOutboundUsageConfirm(from) {
  await syncUserFromTelegram(from);

  const user = await getUserByTelegramId(from.id);
  const balance = user?.balance ?? 0n;
  const existingCount = await countUserNonDeactivatedOutboundUsageSubscriptions(from.id);
  const minBalanceGb = getOutboundUsageRequiredBalanceGb(existingCount);
  const minBalanceIrt = await getOutboundUsageMinimumBalanceIrt(existingCount);

  if (balance < minBalanceIrt) {
    return {
      success: false,
      text: buildOutboundUsageInsufficientBalanceMessage({
        balance,
        minBalanceIrt,
        minBalanceGb,
        hasExistingSubscription: existingCount > 0,
      }),
      keyboard: outboundUsageInsufficientBalanceKeyboard(),
    };
  }

  const server = await pickRandomOutboundUsageServer();
  if (!server) {
    return {
      success: false,
      text: buildOutboundVolumeProvisionFailedMessage(),
      keyboard: outboundSubscriptionDeliveryKeyboard(),
    };
  }

  try {
    const provision = await provisionOutboundUsageUser(server, { userId: from.id });
    const subscription = await createOutboundUsageSubscription({
      userId: from.id,
      server,
      provision,
    });

    logger.info("outbound-usage", "subscription created", {
      userId: String(from.id),
      subscriptionId: String(subscription.id),
      clientEmail: subscription.clientEmail,
      serverId: String(server.id),
    });

    const delivery = buildOutboundSubscriptionDeliveryScreen({
      clientEmail: subscription.clientEmail,
      subscriptionUrl: subscription.connectionLink,
      volumeGb: 0,
      serviceType: ServiceType.OUTBOUND_USAGE,
    });

    return {
      success: true,
      text: delivery.text,
      keyboard: delivery.keyboard,
    };
  } catch (err) {
    logger.error("outbound-usage", "provision failed", { error: err.message });

    return {
      success: false,
      text: buildOutboundVolumeProvisionFailedMessage(),
      keyboard: outboundSubscriptionDeliveryKeyboard(),
    };
  }
}

export async function handleOutboundUsageDeactivate(from, subscriptionId) {
  await syncUserFromTelegram(from);

  const subscription = await findUserOutboundUsageSubscriptionById(
    from.id,
    subscriptionId,
  );

  if (!subscription) {
    return buildOutboundUsageActivationScreen(from);
  }

  const subscriptionName = getSubscriptionDisplayName(subscription);

  try {
    await setPasarGuardUserStatus(
      subscription.server,
      subscription.clientEmail,
      "disabled",
    );

    await prisma.userSubscription.update({
      where: { id: subscription.id },
      data: { panelStatus: SubscriptionPanelStatus.DEACTIVATED },
    });

    logger.info("outbound-usage", "subscription deactivated", {
      userId: String(from.id),
      subscriptionId: String(subscription.id),
      clientEmail: subscription.clientEmail,
    });

    return {
      text: buildOutboundUsageDeactivatedMessage({ subscriptionName }),
      keyboard: outboundUsageDeactivatedKeyboard(),
    };
  } catch (err) {
    logger.error("outbound-usage", "deactivate failed", { error: err.message });

    return {
      text: buildOutboundVolumeProvisionFailedMessage(),
      keyboard: outboundUsageDeactivatedKeyboard(),
    };
  }
}
