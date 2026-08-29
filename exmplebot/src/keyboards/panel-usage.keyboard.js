import { InlineKeyboard } from "grammy";
import { CallbackData } from "../constants/callbacks.js";
import { PremiumEmoji } from "../constants/emojis.js";

export function panelUsagePromptKeyboard() {
  return new InlineKeyboard()
    .text("بازگشت", CallbackData.NEW_SERVICE_PANEL_USAGE)
    .icon(PremiumEmoji.BACK_MENU.id);
}

export { panelUsageSuccessKeyboard } from "./panel-usage-success.keyboard.js";
