import { InlineKeyboard } from "grammy";
import { CallbackData } from "../constants/callbacks.js";
import { PremiumEmoji } from "../constants/emojis.js";

export function outboundUsageActivationKeyboard() {
  return new InlineKeyboard()
    .text("تأیید و فعال‌سازی", CallbackData.NEW_SERVICE_OUTBOUND_USAGE_CONFIRM)
    .icon(PremiumEmoji.DEPOSIT_SUCCESS.id)
    .row()
    .text("بازگشت", CallbackData.NEW_SERVICE_OUTBOUND)
    .icon(PremiumEmoji.BACK_MENU.id)
    .text("انصراف", CallbackData.BACK_TO_MENU)
    .icon(PremiumEmoji.CANCEL.id);
}

export function outboundUsageActiveServiceKeyboard() {
  return new InlineKeyboard()
    .text("تهیه سرویس جدید", CallbackData.NEW_SERVICE_OUTBOUND_USAGE_CONFIRM)
    .icon(PremiumEmoji.OUTBOUND_USAGE_ACTIVATE.id)
    .row()
    .text("بازگشت", CallbackData.NEW_SERVICE_OUTBOUND)
    .icon(PremiumEmoji.BACK_MENU.id)
    .text("انصراف", CallbackData.BACK_TO_MENU)
    .icon(PremiumEmoji.CANCEL.id);
}

export function outboundUsageInsufficientBalanceKeyboard() {
  return new InlineKeyboard()
    .text("شارژ کیف پول", CallbackData.WALLET_TOP_UP)
    .icon(PremiumEmoji.WALLET_TOP_UP.id)
    .row()
    .text("بازگشت", CallbackData.NEW_SERVICE_OUTBOUND_USAGE)
    .icon(PremiumEmoji.BACK_MENU.id);
}

export function outboundUsageDeactivatedKeyboard() {
  return new InlineKeyboard()
    .text("بازگشت", CallbackData.NEW_SERVICE_OUTBOUND)
    .icon(PremiumEmoji.BACK_MENU.id)
    .text("منوی اصلی", CallbackData.BACK_TO_MENU)
    .icon(PremiumEmoji.BACK_MENU.id);
}
