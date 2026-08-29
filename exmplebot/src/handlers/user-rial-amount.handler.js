import {
  MIN_RIAL_DEPOSIT_TOMAN,
  parseTomanAmount,
} from "../lib/parse-amount.js";
import { formatToman } from "../messages/wallet.message.js";
import {
  deleteUserMessage,
  editPromptMessage,
  getPromptRefFromSession,
} from "../lib/prompt-message.js";
import { walletRialTopUpKeyboard } from "../keyboards/wallet-rial-topup.keyboard.js";
import {
  buildWalletRialTopUpMessage,
  walletRialAmountPromptMessage,
} from "../messages/wallet-rial-topup.message.js";
import { getPaymentSettings } from "../services/payment-settings.service.js";
import {
  getUserSession,
  setUserSession,
  UserSessionAction,
} from "../services/user-session.service.js";

export function registerUserRialAmountHandler(bot) {
  bot.on("message:text", async (ctx, next) => {
    if (!ctx.from) {
      return next();
    }

    const session = await getUserSession(ctx.from.id);

    if (!session || session.action !== UserSessionAction.AWAITING_RIAL_AMOUNT) {
      return next();
    }

    const promptRef = getPromptRefFromSession(session);
    const amountIrt = parseTomanAmount(ctx.message.text);

    if (!amountIrt) {
      await deleteUserMessage(ctx);
      await editPromptMessage(
        ctx.api,
        promptRef,
        `⚠️ <b>مبلغ وارد شده معتبر نیست.</b>\n\n${walletRialAmountPromptMessage}`,
        walletRialTopUpKeyboard(),
      );
      return;
    }

    if (amountIrt < MIN_RIAL_DEPOSIT_TOMAN) {
      const minAmount = formatToman(MIN_RIAL_DEPOSIT_TOMAN);

      await deleteUserMessage(ctx);
      await editPromptMessage(
        ctx.api,
        promptRef,
        `⚠️ <b>حداقل مبلغ واریز ${minAmount} تومان است.</b>\n\n${walletRialAmountPromptMessage}`,
        walletRialTopUpKeyboard(),
      );
      return;
    }

    const settings = await getPaymentSettings();

    await setUserSession(ctx.from.id, {
      action: UserSessionAction.AWAITING_RIAL_RECEIPT,
      amountIrt: amountIrt.toString(),
      promptChatId: session.promptChatId,
      promptMessageId: session.promptMessageId,
    });

    await deleteUserMessage(ctx);
    await editPromptMessage(
      ctx.api,
      promptRef,
      buildWalletRialTopUpMessage(settings, amountIrt),
      walletRialTopUpKeyboard(),
    );
  });
}
