import { InlineKeyboard } from "grammy";
import { CallbackData } from "../constants/callbacks.js";
import { PremiumEmoji } from "../constants/emojis.js";

export function panelUnlimitedPromptKeyboard() {
  return new InlineKeyboard()
    .text("بازگشت", CallbackData.NEW_SERVICE_PANEL_VOLUME)
    .icon(PremiumEmoji.BACK_MENU.id);
}
