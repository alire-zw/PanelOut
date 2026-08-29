import { InlineKeyboard } from "grammy";
import { CallbackData } from "../constants/callbacks.js";
import { AdminEmoji } from "../constants/emojis.js";
import { appendBackToAdminRow } from "./back.keyboard.js";

export function adminPanelSettingsKeyboard() {
  const keyboard = new InlineKeyboard()
    .text("ظرفیت نامحدود", CallbackData.ADMIN_SET_PANEL_UNLIMITED_CAPACITY)
    .icon(AdminEmoji.SETTINGS.id)
    .row();

  appendBackToAdminRow(keyboard);
  return keyboard;
}

export function adminPanelSettingsPromptKeyboard() {
  const keyboard = new InlineKeyboard()
    .text("انصراف", CallbackData.ADMIN_PANEL_SETTINGS)
    .icon(AdminEmoji.BACK.id);

  return keyboard;
}
