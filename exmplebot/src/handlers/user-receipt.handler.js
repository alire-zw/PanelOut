import { PremiumEmoji, premiumEmoji } from "../constants/emojis.js";
import {
  deleteUserMessage,
  editPromptMessage,
  getPromptRefFromSession,
} from "../lib/prompt-message.js";
import { walletTopUpKeyboard } from "../keyboards/wallet-topup.keyboard.js";
import { createRialDeposit } from "../services/rial-deposit.service.js";
import { createOutboundVolumeCardOrder } from "../services/outbound-volume-order.service.js";
import {
  outboundVolumeReceiptReceivedMessage,
} from "../messages/outbound-volume-payment.message.js";
import { outboundVolumeReceiptReceivedKeyboard } from "../keyboards/outbound-volume-payment.keyboard.js";
import { syncUserFromTelegram } from "../services/user.service.js";
import {
  clearUserSession,
  getUserSession,
  UserSessionAction,
} from "../services/user-session.service.js";

const receiptReceivedMessage = [
  `${premiumEmoji(PremiumEmoji.RIAL_RECEIPT)} <b>رسید شما دریافت شد</b>`,
  "",
  `${premiumEmoji(PremiumEmoji.RIAL_NOTIFY)} درخواست شارژ پس از بررسی ادمین، از طریق ربات به شما اطلاع داده خواهد شد.`,
].join("\n");

function getReceiptFileId(ctx) {
  if (ctx.message.photo?.length) {
    return {
      fileId: ctx.message.photo[ctx.message.photo.length - 1].file_id,
      type: "photo",
    };
  }

  if (ctx.message.document) {
    return {
      fileId: ctx.message.document.file_id,
      type: "document",
    };
  }

  return null;
}

export function registerUserReceiptHandler(bot) {
  bot.on(["message:photo", "message:document"], async (ctx, next) => {
    if (!ctx.from) {
      return next();
    }

    const session = await getUserSession(ctx.from.id);

    if (!session) {
      return next();
    }

    const receipt = getReceiptFileId(ctx);

    if (!receipt) {
      return next();
    }

    if (session.action === UserSessionAction.AWAITING_RIAL_RECEIPT) {
      if (!session.amountIrt) {
        return next();
      }

      await syncUserFromTelegram(ctx.from);
      await clearUserSession(ctx.from.id);

      await createRialDeposit({
        userId: ctx.from.id,
        amountIrt: session.amountIrt,
        receiptFileId: receipt.fileId,
        receiptType: receipt.type,
      });

      const promptRef = getPromptRefFromSession(session);

      await deleteUserMessage(ctx);
      await editPromptMessage(
        ctx.api,
        promptRef,
        receiptReceivedMessage,
        walletTopUpKeyboard(),
      );
      return;
    }

    if (session.action === UserSessionAction.AWAITING_OUTBOUND_VOLUME_RECEIPT) {
      if (!session.amountIrt || !session.volumeGb) {
        return next();
      }

      await syncUserFromTelegram(ctx.from);
      await clearUserSession(ctx.from.id);

      await createOutboundVolumeCardOrder({
        userId: ctx.from.id,
        volumeGb: session.volumeGb,
        pricePerGb: session.pricePerGb,
        discountPercent: session.discountPercent ?? 0,
        amountIrt: session.amountIrt,
        receiptFileId: receipt.fileId,
        receiptType: receipt.type,
      });

      const promptRef = getPromptRefFromSession(session);

      await deleteUserMessage(ctx);
      await editPromptMessage(
        ctx.api,
        promptRef,
        outboundVolumeReceiptReceivedMessage,
        outboundVolumeReceiptReceivedKeyboard(),
      );
      return;
    }

    return next();
  });
}
