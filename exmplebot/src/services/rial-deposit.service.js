import { getBotInstance } from "../bot/instance.js";
import { handleUserWalletRecharged } from "./wallet-recharge.service.js";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { logger } from "../lib/logger.js";
import { rialDepositReviewKeyboard } from "../keyboards/rial-deposit-admin.keyboard.js";
import { rialDepositSuccessKeyboard } from "../keyboards/rial-deposit-success.keyboard.js";
import {
  buildAdminRialDepositCaption,
  buildUserRialDepositApprovedMessage,
  buildUserRialDepositRejectedMessage,
} from "../messages/rial-deposit-admin.message.js";

export async function createRialDeposit({
  userId,
  amountIrt,
  receiptFileId,
  receiptType,
}) {
  const deposit = await prisma.rialDeposit.create({
    data: {
      userId: BigInt(userId),
      amountIrt: BigInt(amountIrt),
      receiptFileId,
      receiptType,
      status: "pending",
    },
  });

  await notifyAdminsAboutDeposit(deposit.id);

  return deposit;
}

async function getDepositWithUser(depositId) {
  const deposit = await prisma.rialDeposit.findUnique({
    where: { id: BigInt(depositId) },
    include: {
      adminMessages: true,
      user: true,
    },
  });

  if (!deposit) {
    throw new Error("DEPOSIT_NOT_FOUND");
  }

  return deposit;
}

async function notifyAdminsAboutDeposit(depositId) {
  const bot = getBotInstance();

  if (!bot) {
    logger.warn("rial", "notify skip (no bot)");
    return;
  }

  const deposit = await getDepositWithUser(depositId);
  const caption = buildAdminRialDepositCaption(deposit, deposit.user);
  const keyboard = rialDepositReviewKeyboard(deposit.id.toString(), deposit.status);

  for (const adminId of env.adminIds) {
    try {
      const message =
        deposit.receiptType === "document"
          ? await bot.api.sendDocument(adminId, deposit.receiptFileId, {
              caption,
              parse_mode: "HTML",
              reply_markup: keyboard,
            })
          : await bot.api.sendPhoto(adminId, deposit.receiptFileId, {
              caption,
              parse_mode: "HTML",
              reply_markup: keyboard,
            });

      await prisma.rialDepositAdminMessage.create({
        data: {
          depositId: deposit.id,
          adminId: BigInt(adminId),
          chatId: BigInt(message.chat.id),
          messageId: BigInt(message.message_id),
        },
      });
    } catch (err) {
      logger.error("rial", `notify fail ${adminId}`, { error: err.message });
    }
  }

  logger.info("rial", `deposit #${deposit.id} notified`, {
    admins: env.adminIds.size,
  });
}

async function syncAdminDepositMessages(deposit, reviewerName = null) {
  const bot = getBotInstance();

  if (!bot) {
    return;
  }

  const caption = buildAdminRialDepositCaption(
    deposit,
    deposit.user,
    reviewerName,
  );
  const keyboard = rialDepositReviewKeyboard(
    deposit.id.toString(),
    deposit.status,
  );

  for (const ref of deposit.adminMessages) {
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
      logger.warn("rial", `sync fail ${ref.adminId}`, { error: err.message });
    }
  }
}

async function finalizeDeposit(depositId, status, reviewerId, reviewerName) {
  const deposit = await getDepositWithUser(depositId);

  if (deposit.status !== "pending") {
    throw new Error("ALREADY_REVIEWED");
  }

  let newBalance;

  if (status === "approved") {
    newBalance = await prisma.$transaction(async (tx) => {
      const updated = await tx.rialDeposit.updateMany({
        where: { id: deposit.id, status: "pending" },
        data: {
          status: "approved",
          reviewedBy: BigInt(reviewerId),
          reviewedAt: new Date(),
        },
      });

      if (updated.count === 0) {
        throw new Error("ALREADY_REVIEWED");
      }

      const user = await tx.user.update({
        where: { userId: deposit.userId },
        data: {
          balance: { increment: deposit.amountIrt },
          dateUpdated: new Date(),
        },
      });

      return user.balance;
    });
  } else {
    const updated = await prisma.rialDeposit.updateMany({
      where: { id: deposit.id, status: "pending" },
      data: {
        status: "rejected",
        reviewedBy: BigInt(reviewerId),
        reviewedAt: new Date(),
      },
    });

    if (updated.count === 0) {
      throw new Error("ALREADY_REVIEWED");
    }
  }

  const refreshed = await getDepositWithUser(depositId);
  await syncAdminDepositMessages(refreshed, reviewerName);

  const bot = getBotInstance();

  if (bot) {
    if (status === "approved") {
      await bot.api.sendMessage(
        Number(deposit.userId),
        buildUserRialDepositApprovedMessage(deposit.amountIrt, newBalance),
        {
          parse_mode: "HTML",
          reply_markup: rialDepositSuccessKeyboard(),
        },
      );

      await handleUserWalletRecharged(deposit.userId);
    } else {
      await bot.api.sendMessage(
        Number(deposit.userId),
        buildUserRialDepositRejectedMessage(deposit.amountIrt),
        { parse_mode: "HTML" },
      );
    }
  }

  logger.info("rial", `deposit #${depositId} ${status}`, {
    by: reviewerId,
  });

  return refreshed;
}

export async function approveRialDeposit(depositId, reviewerId, reviewerName) {
  return finalizeDeposit(depositId, "approved", reviewerId, reviewerName);
}

export async function rejectRialDeposit(depositId, reviewerId, reviewerName) {
  return finalizeDeposit(depositId, "rejected", reviewerId, reviewerName);
}
