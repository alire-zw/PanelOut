import { InlineKeyboard } from "grammy";
import { CallbackData } from "../constants/callbacks.js";
import { PremiumEmoji } from "../constants/emojis.js";

export function newServicePanelKeyboard({ showTrial = true } = {}) {
  const keyboard = new InlineKeyboard();

  if (showTrial) {
    keyboard
      .text("ساخت اکانت و تست سرویس", CallbackData.NEW_SERVICE_PANEL_TRIAL)
      .icon(PremiumEmoji.PANEL_TRIAL_BTN.id)
      .row();
  }

  return keyboard
    .text("نامحدود", CallbackData.NEW_SERVICE_PANEL_VOLUME)
    .icon(PremiumEmoji.VOLUME_PACKAGE_BTN.id)
    .text("به ازای مصرف", CallbackData.NEW_SERVICE_PANEL_USAGE)
    .icon(PremiumEmoji.PAY_AS_YOU_GO_BTN.id)
    .row()
    .text("بازگشت", CallbackData.NEW_SERVICE)
    .icon(PremiumEmoji.BACK_MENU.id);
}
