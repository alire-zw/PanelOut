import { InlineKeyboard } from "grammy";
import { CallbackData } from "../constants/callbacks.js";
import { PremiumEmoji } from "../constants/emojis.js";

export function walletTopUpMethodKeyboard({ tron, rial }) {
  const keyboard = new InlineKeyboard();

  if (tron) {
    keyboard
      .text("واریز ترون", CallbackData.WALLET_TOP_UP_TRON)
      .icon(PremiumEmoji.TOPUP_BTN_TRON.id);
  }

  if (rial) {
    keyboard
      .text("کارت به کارت", CallbackData.WALLET_TOP_UP_RIAL)
      .icon(PremiumEmoji.TOPUP_BTN_CARD.id);
  }

  if (tron || rial) {
    keyboard.row();
  }

  keyboard
    .text("بازگشت به کیف پول", CallbackData.WALLET)
    .icon(PremiumEmoji.BACK_MENU.id);

  return keyboard;
}
