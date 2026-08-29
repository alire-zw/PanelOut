import { InlineKeyboard } from "grammy";
import { CallbackData } from "../constants/callbacks.js";
import { PremiumEmoji } from "../constants/emojis.js";

export function newServiceKeyboard() {
  return new InlineKeyboard()
    .text("سرویس اوتباند", CallbackData.NEW_SERVICE_OUTBOUND)
    .icon(PremiumEmoji.SERVICE_OUTBOUND_BTN.id)
    .text("سرویس پنل", CallbackData.NEW_SERVICE_PANEL)
    .icon(PremiumEmoji.SERVICE_PANEL_BTN.id)
    .row()
    .text("بازگشت به منوی اصلی", CallbackData.BACK_TO_MENU)
    .icon(PremiumEmoji.BACK_MENU.id);
}
