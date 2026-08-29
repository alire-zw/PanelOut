import { InlineKeyboard } from "grammy";
import { CallbackData } from "../constants/callbacks.js";
import { PremiumEmoji } from "../constants/emojis.js";

export function newServiceOutboundKeyboard() {
  return new InlineKeyboard()
    .text("پکیج حجمی", CallbackData.NEW_SERVICE_OUTBOUND_VOLUME)
    .icon(PremiumEmoji.VOLUME_PACKAGE_BTN.id)
    .text("به ازای مصرف", CallbackData.NEW_SERVICE_OUTBOUND_USAGE)
    .icon(PremiumEmoji.PAY_AS_YOU_GO_BTN.id)
    .row()
    .text("بازگشت", CallbackData.NEW_SERVICE)
    .icon(PremiumEmoji.BACK_MENU.id);
}
