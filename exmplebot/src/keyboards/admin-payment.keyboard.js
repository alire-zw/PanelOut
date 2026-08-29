import { InlineKeyboard } from "grammy";
import { CallbackData } from "../constants/callbacks.js";
import { AdminEmoji } from "../constants/emojis.js";
import { appendBackToAdminRow } from "./back.keyboard.js";
import {
  formatCardNumber,
  formatShebaNumber,
} from "../services/payment-settings.service.js";

const NOT_SET = "تنظیم نشده";

function labelButton(keyboard, text, icon = AdminEmoji.DESC.id) {
  return keyboard.text(text, CallbackData.ADMIN_PAYMENT_DISPLAY).icon(icon);
}

function truncateDisplay(text, maxLength = 18) {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, 6)}...${text.slice(-6)}`;
}

function maskCardNumber(cardNumber) {
  const digits = cardNumber.replace(/\D/g, "");
  return `****-${digits.slice(-4)}`;
}

function statusLabel(enabled) {
  return enabled ? "فعال" : "غیرفعال";
}

export function adminPaymentMainKeyboard() {
  const keyboard = new InlineKeyboard()
    .text("تنظیمات ترون", CallbackData.ADMIN_TRON_SETTINGS)
    .icon(AdminEmoji.TRON.id)
    .text("تنظیمات ریالی", CallbackData.ADMIN_RIAL_SETTINGS)
    .icon(AdminEmoji.RIAL.id)
    .row();

  appendBackToAdminRow(keyboard);

  return keyboard;
}

export function adminTronSettingsKeyboard(settings) {
  const keyboard = new InlineKeyboard();
  const hasMaster = Boolean(settings.masterWalletAddress);

  labelButton(keyboard, "وضعیت پرداخت ترون", AdminEmoji.STATUS.id);
  keyboard.row();

  keyboard.text(statusLabel(settings.tronEnabled), CallbackData.ADMIN_PAYMENT_DISPLAY);
  keyboard.row();

  keyboard
    .text(
      settings.tronEnabled ? "غیرفعال کردن ترون" : "فعال کردن ترون",
      CallbackData.ADMIN_TOGGLE_TRON,
    )
    .icon(AdminEmoji.TRON.id);
  keyboard.row();

  labelButton(keyboard, "ولت مستر", AdminEmoji.MASTER.id);
  keyboard.row();

  keyboard.text(
    hasMaster ? truncateDisplay(settings.masterWalletAddress, 20) : NOT_SET,
    CallbackData.ADMIN_PAYMENT_DISPLAY,
  );
  keyboard.row();

  keyboard
    .text(hasMaster ? "تغییر ولت مستر" : "تنظیم ولت مستر", CallbackData.ADMIN_SET_MASTER_WALLET)
    .icon(AdminEmoji.EDIT.id);

  if (hasMaster) {
    keyboard.text("حذف ولت مستر", CallbackData.ADMIN_CLEAR_MASTER_WALLET);
  }

  keyboard.row();

  keyboard
    .text("بروزرسانی", CallbackData.ADMIN_REFRESH_TRON)
    .icon(AdminEmoji.REFRESH.id)
    .row()
    .text("بازگشت", CallbackData.ADMIN_PAYMENT_SETTINGS)
    .icon(AdminEmoji.BACK.id);

  return keyboard;
}

export function adminRialSettingsKeyboard(settings) {
  const keyboard = new InlineKeyboard();
  const hasCard = Boolean(settings.cardNumber);
  const hasSheba = Boolean(settings.shebaNumber);

  labelButton(keyboard, "وضعیت پرداخت ریالی", AdminEmoji.STATUS.id);
  keyboard.row();

  keyboard.text(statusLabel(settings.rialEnabled), CallbackData.ADMIN_PAYMENT_DISPLAY);
  keyboard.row();

  keyboard
    .text(
      settings.rialEnabled ? "غیرفعال کردن ریالی" : "فعال کردن ریالی",
      CallbackData.ADMIN_TOGGLE_RIAL,
    )
    .icon(AdminEmoji.RIAL.id);
  keyboard.row();

  labelButton(keyboard, "شماره کارت", AdminEmoji.CARD.id);
  labelButton(keyboard, "شبا", AdminEmoji.SHEBA.id);
  keyboard.row();

  keyboard
    .text(hasCard ? maskCardNumber(settings.cardNumber) : NOT_SET, CallbackData.ADMIN_PAYMENT_DISPLAY)
    .text(
      hasSheba ? truncateDisplay(formatShebaNumber(settings.shebaNumber), 20) : NOT_SET,
      CallbackData.ADMIN_PAYMENT_DISPLAY,
    );
  keyboard.row();

  keyboard
    .text(hasCard ? "تغییر کارت" : "تنظیم کارت", CallbackData.ADMIN_SET_CARD)
    .icon(AdminEmoji.CARD.id)
    .text(hasSheba ? "تغییر شبا" : "تنظیم شبا", CallbackData.ADMIN_SET_SHEBA)
    .icon(AdminEmoji.SHEBA.id);
  keyboard.row();

  if (hasCard || hasSheba) {
    if (hasCard) {
      keyboard.text("حذف کارت", CallbackData.ADMIN_CLEAR_CARD);
    }

    if (hasSheba) {
      keyboard.text("حذف شبا", CallbackData.ADMIN_CLEAR_SHEBA);
    }

    keyboard.row();
  }

  keyboard
    .text("بروزرسانی", CallbackData.ADMIN_REFRESH_RIAL)
    .icon(AdminEmoji.REFRESH.id)
    .row()
    .text("بازگشت", CallbackData.ADMIN_PAYMENT_SETTINGS)
    .icon(AdminEmoji.BACK.id);

  return keyboard;
}

export function adminPaymentPromptKeyboard(returnTo) {
  const cancelCallback =
    returnTo === "tron"
      ? CallbackData.ADMIN_TRON_SETTINGS
      : returnTo === "rial"
        ? CallbackData.ADMIN_RIAL_SETTINGS
        : CallbackData.ADMIN_PAYMENT_SETTINGS;

  return new InlineKeyboard()
    .text("انصراف", cancelCallback)
    .icon(AdminEmoji.BACK.id);
}
