import { InlineKeyboard } from "grammy";
import { CallbackData } from "../constants/callbacks.js";
import { AdminEmoji } from "../constants/emojis.js";
import { appendBackToAdminRow } from "./back.keyboard.js";

export function adminPricingSettingsKeyboard() {
  const keyboard = new InlineKeyboard()
    .text("پنل مصرفی (هر گیگ)", CallbackData.ADMIN_SET_PANEL_USAGE_PRICE)
    .icon(AdminEmoji.TRAFFIC.id)
    .row()
    .text("اوتباند (هر گیگ)", CallbackData.ADMIN_SET_OUTBOUND_PRICE)
    .icon(AdminEmoji.TRAFFIC.id)
    .row()
    .text("نامحدود (هر اشتراک)", CallbackData.ADMIN_SET_UNLIMITED_SUB_PRICE)
    .icon(AdminEmoji.SALES.id)
    .row()
    .text("نامحدود (هر کاربر)", CallbackData.ADMIN_SET_UNLIMITED_USER_PRICE)
    .icon(AdminEmoji.SALES.id)
    .row();

  appendBackToAdminRow(keyboard);
  return keyboard;
}

export function adminPricingSettingsPromptKeyboard() {
  return new InlineKeyboard()
    .text("انصراف", CallbackData.ADMIN_PRICING_SETTINGS)
    .icon(AdminEmoji.BACK.id);
}
