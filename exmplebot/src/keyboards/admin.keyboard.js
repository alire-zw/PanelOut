import { InlineKeyboard } from "grammy";
import { CallbackData } from "../constants/callbacks.js";
import { AdminEmoji } from "../constants/emojis.js";

export function adminPanelKeyboard() {
  return new InlineKeyboard()
    .text("آمار کاربران", CallbackData.ADMIN_USERS_STATS)
    .icon(AdminEmoji.USER_STATS.id)
    .text("تنظیمات پرداخت", CallbackData.ADMIN_PAYMENT_SETTINGS)
    .icon(AdminEmoji.PAYMENT.id)
    .row()
    .text("مدیریت کانال‌ها", CallbackData.ADMIN_CHANNELS)
    .icon(AdminEmoji.CHANNELS.id)
    .text("مدیریت سرورها", CallbackData.ADMIN_SERVERS)
    .icon(AdminEmoji.SERVERS.id)
    .row()
    .text("تنظیمات ظرفیت", CallbackData.ADMIN_PANEL_SETTINGS)
    .icon(AdminEmoji.SETTINGS.id)
    .text("قیمت‌گذاری", CallbackData.ADMIN_PRICING_SETTINGS)
    .icon(AdminEmoji.PAYMENT.id)
    .row()
    .text("بازگشت به منوی اصلی", CallbackData.BACK_TO_MENU)
    .icon(AdminEmoji.BACK.id);
}
