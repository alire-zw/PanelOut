import { InlineKeyboard } from "grammy";
import {
  CallbackData,
  outboundVolumeContinueCallback,
  outboundVolumeDecCallback,
  outboundVolumeIncCallback,
} from "../constants/callbacks.js";
import { PremiumEmoji } from "../constants/emojis.js";
import { formatOutboundVolumeLabel } from "../lib/outbound-volume-steps.js";

export function newServiceOutboundVolumeKeyboard(selectedGb) {
  return new InlineKeyboard()
    .text("کاهش", outboundVolumeDecCallback(selectedGb))
    .icon(PremiumEmoji.VOLUME_DECREASE.id)
    .text(formatOutboundVolumeLabel(selectedGb), CallbackData.NEW_SERVICE_OUTBOUND_VOLUME_DISPLAY)
    .primary()
    .text("افزایش", outboundVolumeIncCallback(selectedGb))
    .icon(PremiumEmoji.VOLUME_INCREASE.id)
    .row()
    .text("تایید و ادامه خرید", outboundVolumeContinueCallback(selectedGb))
    .icon(PremiumEmoji.SERVICE_PANEL_BTN.id)
    .success()
    .row()
    .text("بازگشت", CallbackData.NEW_SERVICE_OUTBOUND)
    .icon(PremiumEmoji.BACK_MENU.id);
}
