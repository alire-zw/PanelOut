import { InlineKeyboard } from "grammy";
import { CallbackData } from "../constants/callbacks.js";
import { PremiumEmoji } from "../constants/emojis.js";
import { buildPanelUsageActiveGlassKeyboard } from "./panel-admin-glass.keyboard.js";

export function panelUsageActivationKeyboard() {
  return new InlineKeyboard()
    .text("تأیید و فعال‌سازی", CallbackData.NEW_SERVICE_PANEL_USAGE_CONFIRM)
    .icon(PremiumEmoji.DEPOSIT_SUCCESS.id)
    .row()
    .text("بازگشت", CallbackData.NEW_SERVICE_PANEL)
    .icon(PremiumEmoji.BACK_MENU.id)
    .text("انصراف", CallbackData.BACK_TO_MENU)
    .icon(PremiumEmoji.CANCEL.id);
}

export function panelUsageActiveServiceKeyboard({
  username,
  password,
  panelUrl,
  usedLabel,
  statusLabel,
}) {
  return buildPanelUsageActiveGlassKeyboard({
    username,
    password,
    panelUrl,
    usedLabel,
    statusLabel,
  });
}

export function panelUsageInsufficientBalanceKeyboard() {
  return new InlineKeyboard()
    .text("شارژ کیف پول", CallbackData.WALLET_TOP_UP)
    .icon(PremiumEmoji.WALLET_TOP_UP.id)
    .row()
    .text("بازگشت", CallbackData.NEW_SERVICE_PANEL_USAGE)
    .icon(PremiumEmoji.BACK_MENU.id);
}
