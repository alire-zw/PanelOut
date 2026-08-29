import { ServiceType } from "../constants/service-types.js";
import { getBotInstance } from "../bot/instance.js";
import { prisma } from "../db/prisma.js";
import { logger } from "../lib/logger.js";
import { outboundSubscriptionDeliveryKeyboard } from "../keyboards/outbound-subscription-delivery.keyboard.js";
import { buildOutboundSubscriptionDeliveryMessage } from "../messages/outbound-subscription-delivery.message.js";
import { buildOutboundVolumeProvisionFailedMessage } from "../messages/outbound-volume-payment.message.js";
import { provisionOutboundVolumeUser } from "./pasarguard-provision.service.js";
import {
  getAllServers,
  isServerActive,
  isServerOutboundVolumeEnabled,
  isServerSalesEnabled,
} from "./server.service.js";
export async function pickRandomOutboundVolumeServer() {
  const servers = await getAllServers();
  const eligible = servers.filter(
    (server) =>
      isServerActive(server) &&
      isServerSalesEnabled(server) &&
      isServerOutboundVolumeEnabled(server),
  );

  if (!eligible.length) return null;

  return eligible[Math.floor(Math.random() * eligible.length)];
}

async function markOrderProvisionFailed(orderId, errorMessage) {
  await prisma.outboundVolumeOrder.update({
    where: { id: BigInt(orderId) },
    data: {
      provisionError: errorMessage,
    },
  });
}

export async function deliverOutboundSubscriptionToUser(userId, delivery) {
  const bot = getBotInstance();
  if (!bot) return;

  await bot.api.sendMessage(Number(userId), delivery.text, {
    parse_mode: "HTML",
    reply_markup: delivery.keyboard,
    link_preview_options: { is_disabled: true },
  });
}

export function buildOutboundSubscriptionDeliveryScreen({
  clientEmail,
  subscriptionUrl,
  volumeGb,
  serviceType = ServiceType.OUTBOUND_VOLUME,
}) {
  return {
    text: buildOutboundSubscriptionDeliveryMessage({
      clientEmail,
      subscriptionUrl,
      volumeGb,
      serviceType,
    }),
    keyboard: outboundSubscriptionDeliveryKeyboard(),
  };
}

export async function fulfillOutboundVolumeOrder(orderId) {
  const order = await prisma.outboundVolumeOrder.findUnique({
    where: { id: BigInt(orderId) },
    include: {
      subscription: {
        include: { server: true },
      },
    },
  });

  if (!order) {
    throw new Error("ORDER_NOT_FOUND");
  }

  if (order.fulfilledAt || order.subscriptionId) {
    const subscription = order.subscription;

    if (subscription) {
      return {
        alreadyFulfilled: true,
        delivery: buildOutboundSubscriptionDeliveryScreen({
          clientEmail: subscription.clientEmail,
          subscriptionUrl: subscription.connectionLink,
          volumeGb: subscription.volumeGb,
        }),
      };
    }

    return { alreadyFulfilled: true, delivery: null };
  }

  if (order.status !== "completed") {
    throw new Error("ORDER_NOT_COMPLETED");
  }

  const server = await pickRandomOutboundVolumeServer();
  if (!server) {
    const message = "هیچ سرور فعالی برای سرویس اوتباند حجمی یافت نشد.";
    await markOrderProvisionFailed(order.id, message);
    throw new Error("NO_ELIGIBLE_SERVER");
  }

  try {
    const provision = await provisionOutboundVolumeUser(server, {
      volumeGb: order.volumeGb,
      userId: order.userId,
    });

    const subscription = await prisma.$transaction(async (tx) => {
      const created = await tx.userSubscription.create({
        data: {
          userId: order.userId,
          serverId: server.id,
          serviceType: ServiceType.OUTBOUND_VOLUME,
          volumeGb: order.volumeGb,
          groupIds: provision.inboundId,
          connectionLink: provision.subscriptionUrl,
          panelSubId: provision.subId,
          clientEmail: provision.clientEmail,
          remark: provision.remark,
          paymentMethod: order.paymentMethod,
        },
      });

      await tx.outboundVolumeOrder.update({
        where: { id: order.id },
        data: {
          fulfilledAt: new Date(),
          subscriptionId: created.id,
          provisionError: null,
        },
      });

      return created;
    });

    const delivery = buildOutboundSubscriptionDeliveryScreen({
      clientEmail: subscription.clientEmail,
      subscriptionUrl: subscription.connectionLink,
      volumeGb: subscription.volumeGb,
    });

    logger.info("outbound-fulfillment", `order #${orderId} fulfilled`, {
      subscriptionId: String(subscription.id),
      serverId: String(server.id),
      clientEmail: subscription.clientEmail,
    });

    return { success: true, subscription, delivery, server };
  } catch (err) {
    const message = err.message || "Provision failed";
    await markOrderProvisionFailed(order.id, message);
    logger.error("outbound-fulfillment", `order #${orderId} failed`, { error: message });
    throw err;
  }
}

export async function fulfillAndDeliverOutboundVolumeOrder(orderId, userId) {
  try {
    const result = await fulfillOutboundVolumeOrder(orderId);

    if (result.delivery) {
      await deliverOutboundSubscriptionToUser(userId, result.delivery);
    }

    return result;
  } catch (err) {
    await deliverOutboundSubscriptionToUser(userId, {
      text: buildOutboundVolumeProvisionFailedMessage(),
      keyboard: outboundSubscriptionDeliveryKeyboard(),
    });
    throw err;
  }
}
