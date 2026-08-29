import { InlineKeyboard } from "grammy";
import { CallbackData } from "../constants/callbacks.js";
import { PremiumEmoji } from "../constants/emojis.js";

export function rialDepositSuccessKeyboard() {
  return new InlineKeyboard()
    .text("تهیه سرویس جدید", CallbackData.NEW_SERVICE)
    .icon(PremiumEmoji.NEW_SERVICE.id)
    .row()
    .text("بازگشت به منوی اصلی", CallbackData.BACK_TO_MENU)
    .icon(PremiumEmoji.BACK_MENU.id);
}
