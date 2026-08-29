import { InlineKeyboard } from "grammy";
import { CallbackData } from "../constants/callbacks.js";
import { PremiumEmoji } from "../constants/emojis.js";

export function walletTopUpKeyboard() {
  return new InlineKeyboard()
    .text("بازگشت به کیف پول", CallbackData.WALLET)
    .icon(PremiumEmoji.BACK_MENU.id);
}
