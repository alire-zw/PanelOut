import { InlineKeyboard } from "grammy";
import { CallbackData } from "../constants/callbacks.js";
import { AdminEmoji } from "../constants/emojis.js";
import { appendBackToAdminRow } from "./back.keyboard.js";

function formatCount(value) {
  return Number(value).toLocaleString("en-US");
}

function labelButton(keyboard, text, icon) {
  return keyboard.text(text, CallbackData.ADMIN_STATS_DISPLAY).icon(icon);
}

export function adminUsersStatsKeyboard(stats) {
  const keyboard = new InlineKeyboard();

  labelButton(keyboard, "کل کاربران", AdminEmoji.USER_STATS.id);
  labelButton(keyboard, "کاربران پریمیوم", AdminEmoji.PREMIUM.id);
  keyboard.row();

  keyboard
    .text(formatCount(stats.total), CallbackData.ADMIN_STATS_DISPLAY)
    .text(formatCount(stats.premium), CallbackData.ADMIN_STATS_DISPLAY);
  keyboard.row();

  labelButton(keyboard, "آمار زمانی کاربران", AdminEmoji.TIME.id);
  keyboard.row();

  labelButton(keyboard, "امروز", AdminEmoji.TODAY.id);
  labelButton(keyboard, "هفته", AdminEmoji.WEEK.id);
  labelButton(keyboard, "ماه", AdminEmoji.MONTH.id);
  keyboard.row();

  keyboard
    .text(formatCount(stats.today), CallbackData.ADMIN_STATS_DISPLAY)
    .text(formatCount(stats.week), CallbackData.ADMIN_STATS_DISPLAY)
    .text(formatCount(stats.month), CallbackData.ADMIN_STATS_DISPLAY);
  keyboard.row();

  keyboard
    .text("بروزرسانی آمار", CallbackData.ADMIN_REFRESH_STATS)
    .icon(AdminEmoji.REFRESH.id);
  keyboard.row();

  appendBackToAdminRow(keyboard);

  return keyboard;
}
