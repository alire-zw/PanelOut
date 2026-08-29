import { getBotInstance } from "../bot/instance.js";
import { depositSuccessKeyboard } from "../keyboards/deposit.keyboard.js";
import { logger } from "../lib/logger.js";
import { buildDepositSuccessMessage } from "../messages/deposit.message.js";

export async function notifyDepositSuccess({
  telegramUserId,
  amountTrx,
  amountIrt,
  newBalance,
  txHash,
}) {
  const bot = getBotInstance();

  if (!bot) {
    logger.warn("notify", "bot not ready");
    return;
  }

  try {
    await bot.api.sendMessage(
      Number(telegramUserId),
      buildDepositSuccessMessage({
        amountTrx,
        amountIrt,
        newBalance,
      }),
      {
        parse_mode: "HTML",
        reply_markup: depositSuccessKeyboard(txHash),
      },
    );

    logger.info("notify", `deposit sent ${telegramUserId}`);
  } catch (err) {
    logger.error("notify", `deposit fail ${telegramUserId}`, {
      error: err.message,
    });
  }
}
