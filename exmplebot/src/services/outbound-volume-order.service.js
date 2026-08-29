import { getBotInstance } from "../bot/instance.js";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { logger } from "../lib/logger.js";
import { outboundVolumeOrderReviewKeyboard } from "../keyboards/outbound-volume-order-admin.keyboard.js";
import { outboundVolumeWalletSuccessKeyboard } from "../keyboards/outbound-volume-payment.keyboard.js";
import {
  buildAdminOutboundVolumeOrderCaption,
  buildUserOutboundVolumeOrderRejectedMessage,
} from "../messages/outbound-volume-order-admin.message.js";
import { buildOutboundVolumeWalletSuccessMessage } from "../messages/outbound-volume-payment.message.js";
import { fulfillAndDeliverOutboundVolumeOrder } from "./outbound-subscription-fulfillment.service.js";

export async function createOutboundVolumeCardOrder({
  userId,
  volumeGb,
  pricePerGb,
  discountPercent,
  amountIrt,
  receiptFileId,
  receiptType,
}) {
  const order = await prisma.outboundVolumeOrder.create({
    data: {
      userId: BigInt(userId),
      volumeGb,
      pricePerGb,
      discountPercent,
      amountIrt: BigInt(amountIrt),
      paymentMethod: "card",
      status: "pending",
      receiptFileId,
      receiptType,
    },
  });

  await notifyAdminsAboutOrder(order.id);
  return order;
}

export async function payOutboundVolumeWithWallet({
  userId,
  volumeGb,
  pricePerGb,
  discountPercent,
  amountIrt,
}) {
  const amount = BigInt(amountIrt);
  const userIdBig = BigInt(userId);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { userId: userIdBig },
    });

    if (!user || user.balance < amount) {
      throw new Error("INSUFFICIENT_BALANCE");
    }

    const updatedUser = await tx.user.update({
      where: { userId: userIdBig },
      data: {
        balance: { decrement: amount },
        dateUpdated: new Date(),
      },
    });

    const order = await tx.outboundVolumeOrder.create({
      data: {
        userId: userIdBig,
        volumeGb,
        pricePerGb,
        discountPercent,
        amountIrt: amount,
        paymentMethod: "wallet",
        status: "completed",
        reviewedAt: new Date(),
      },
    });

    return { order, newBalance: updatedUser.balance };
  });
}

async function getOrderWithUser(orderId) {
  const order = await prisma.outboundVolumeOrder.findUnique({
    where: { id: BigInt(orderId) },
    include: {
      adminMessages: true,
      user: true,
    },
  });

  if (!order) {
    throw new Error("ORDER_NOT_FOUND");
  }

  return order;
}

async function notifyAdminsAboutOrder(orderId) {
  const bot = getBotInstance();

  if (!bot) {
    logger.warn("outbound-order", "notify skip (no bot)");
    return;
  }

  const order = await getOrderWithUser(orderId);
  const caption = buildAdminOutboundVolumeOrderCaption(order, order.user);
  const keyboard = outboundVolumeOrderReviewKeyboard(order.id.toString(), order.status);

  for (const adminId of env.adminIds) {
    try {
      const message =
        order.receiptType === "document"
          ? await bot.api.sendDocument(adminId, order.receiptFileId, {
              caption,
              parse_mode: "HTML",
              reply_markup: keyboard,
            })
          : await bot.api.sendPhoto(adminId, order.receiptFileId, {
              caption,
              parse_mode: "HTML",
              reply_markup: keyboard,
            });

      await prisma.outboundVolumeOrderAdminMessage.create({
        data: {
          orderId: order.id,
          adminId: BigInt(adminId),
          chatId: BigInt(message.chat.id),
          messageId: BigInt(message.message_id),
        },
      });
    } catch (err) {
      logger.error("outbound-order", `notify fail ${adminId}`, { error: err.message });
    }
  }
}

async function syncAdminOrderMessages(order, reviewerName = null) {
  const bot = getBotInstance();

  if (!bot) {
    return;
  }

  const caption = buildAdminOutboundVolumeOrderCaption(order, order.user, reviewerName);
  const keyboard = outboundVolumeOrderReviewKeyboard(order.id.toString(), order.status);

  for (const ref of order.adminMessages) {
    try {
      await bot.api.editMessageCaption(
        Number(ref.chatId),
        Number(ref.messageId),
        {
          caption,
          parse_mode: "HTML",
          reply_markup: keyboard,
        },
      );
    } catch (err) {
      logger.warn("outbound-order", `sync fail ${ref.adminId}`, { error: err.message });
    }
  }
}

async function finalizeOrder(orderId, status, reviewerId, reviewerName) {
  const order = await getOrderWithUser(orderId);

  if (order.status !== "pending") {
    throw new Error("ALREADY_REVIEWED");
  }

  const finalStatus = status === "approved" ? "completed" : "rejected";

  const updated = await prisma.outboundVolumeOrder.updateMany({
    where: { id: order.id, status: "pending" },
    data: {
      status: finalStatus,
      reviewedBy: BigInt(reviewerId),
      reviewedAt: new Date(),
    },
  });

  if (updated.count === 0) {
    throw new Error("ALREADY_REVIEWED");
  }

  const refreshed = await getOrderWithUser(orderId);
  await syncAdminOrderMessages(refreshed, reviewerName);

  const bot = getBotInstance();

  if (bot) {
    if (finalStatus === "completed") {
      try {
        await fulfillAndDeliverOutboundVolumeOrder(orderId, refreshed.userId);
      } catch (err) {
        logger.error("outbound-order", `fulfillment fail #${orderId}`, {
          error: err.message,
        });
      }
    } else {
      const message = buildUserOutboundVolumeOrderRejectedMessage(refreshed);

      await bot.api.sendMessage(Number(refreshed.userId), message, {
        parse_mode: "HTML",
      });
    }
  }

  logger.info("outbound-order", `order #${orderId} ${finalStatus}`, { by: reviewerId });

  return refreshed;
}

export async function approveOutboundVolumeOrder(orderId, reviewerId, reviewerName) {
  return finalizeOrder(orderId, "approved", reviewerId, reviewerName);
}

export async function rejectOutboundVolumeOrder(orderId, reviewerId, reviewerName) {
  return finalizeOrder(orderId, "rejected", reviewerId, reviewerName);
}

export function buildWalletPaymentSuccessScreen({ volumeGb, amountIrt, newBalance }) {
  return {
    text: buildOutboundVolumeWalletSuccessMessage({ volumeGb, amountIrt, newBalance }),
    keyboard: outboundVolumeWalletSuccessKeyboard(),
  };
}
