import { InlineKeyboard } from "grammy";
import { CallbackData } from "../constants/callbacks.js";
import { AdminEmoji, PremiumEmoji } from "../constants/emojis.js";
import { env } from "../config/env.js";
import { SUPPORT_TELEGRAM_URL } from "../messages/support.message.js";

export function startKeyboard(isAdmin = false) {
  const keyboard = new InlineKeyboard()
    .text("تهیه سرویس جدید", CallbackData.NEW_SERVICE)
    .icon(PremiumEmoji.NEW_SERVICE.id)
    .row()
    .text("کیف پول", CallbackData.WALLET)
    .icon(PremiumEmoji.WALLET.id)
    .text("مدیریت سرویس‌ها", CallbackData.MANAGE_SERVICES)
    .icon(PremiumEmoji.MANAGE_SERVICES.id)
    .row()
    .url("پشتیبانی", SUPPORT_TELEGRAM_URL)
    .icon(PremiumEmoji.SUPPORT.id)
    .url("سوالات متداول", env.faqPublicUrl)
    .icon(PremiumEmoji.FAQ.id);

  if (isAdmin) {
    keyboard
      .row()
      .text("پنل مدیریت ربات", CallbackData.ADMIN)
      .icon(AdminEmoji.PANEL.id);
  }

  return keyboard;
}
