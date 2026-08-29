import { InlineKeyboard } from "grammy";
import { CallbackData } from "../constants/callbacks.js";
import { PremiumEmoji } from "../constants/emojis.js";

export function outboundVolumeLowRemainingKeyboard() {
  return new InlineKeyboard()
    .text("خرید پکیج حجمی", CallbackData.NEW_SERVICE_OUTBOUND_VOLUME)
    .icon(PremiumEmoji.VOLUME_PACKAGE_BTN.id);
}
