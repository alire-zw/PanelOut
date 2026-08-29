import { InlineKeyboard } from "grammy";
import { CallbackData } from "../constants/callbacks.js";
import { AdminEmoji, PremiumEmoji } from "../constants/emojis.js";

export function backToMenuKeyboard() {
  return new InlineKeyboard()
    .text("بازگشت به منوی اصلی", CallbackData.BACK_TO_MENU)
    .icon(PremiumEmoji.BACK_MENU.id);
}

export function backToAdminKeyboard() {
  return new InlineKeyboard()
    .text("بازگشت به منوی ادمین", CallbackData.ADMIN_BACK)
    .icon(AdminEmoji.BACK.id);
}

export function appendBackToAdminRow(keyboard) {
  return keyboard
    .text("بازگشت به منوی ادمین", CallbackData.ADMIN_BACK)
    .icon(AdminEmoji.BACK.id);
}

export function appendBackToMenuRow(keyboard) {
  return keyboard
    .text("بازگشت به منوی اصلی", CallbackData.BACK_TO_MENU)
    .icon(PremiumEmoji.BACK_MENU.id);
}
