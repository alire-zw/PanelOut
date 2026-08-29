import { InlineKeyboard } from "grammy";
import {
  CallbackData,
  panelVolumeContinueCallback,
  panelVolumeDaysDecCallback,
  panelVolumeDaysIncCallback,
  panelVolumeDecCallback,
  panelVolumeIncCallback,
  panelVolumeUsersDecCallback,
  panelVolumeUsersIncCallback,
} from "../constants/callbacks.js";
import { PremiumEmoji } from "../constants/emojis.js";
import { formatPanelUnlimitedCountLabel } from "../lib/panel-unlimited-steps.js";
import { formatPanelUnlimitedDaysLabel } from "../lib/panel-unlimited-days-steps.js";
import { formatPanelUnlimitedMaxUsersLabel } from "../lib/panel-unlimited-users-steps.js";

export function newServicePanelVolumeKeyboard({
  selectedCount,
  selectedMaxUsers,
  selectedDays,
  remaining,
  canIncrease = true,
  canDecrease = true,
  canIncreaseUsers = true,
  canDecreaseUsers = true,
  canIncreaseDays = true,
  canDecreaseDays = true,
  canContinue = true,
}) {
  const keyboard = new InlineKeyboard();

  if (remaining > 0 && selectedCount > 0) {
    keyboard
      .text("کاهش", panelVolumeDecCallback(selectedCount, selectedMaxUsers, selectedDays))
      .icon(PremiumEmoji.VOLUME_DECREASE.id)
      .text(formatPanelUnlimitedCountLabel(selectedCount), CallbackData.NEW_SERVICE_PANEL_VOLUME_DISPLAY)
      .primary()
      .text("افزایش", panelVolumeIncCallback(selectedCount, selectedMaxUsers, selectedDays))
      .icon(PremiumEmoji.VOLUME_INCREASE.id)
      .row()
      .text("کاهش", panelVolumeUsersDecCallback(selectedCount, selectedMaxUsers, selectedDays))
      .icon(PremiumEmoji.VOLUME_DECREASE.id)
      .text(
        formatPanelUnlimitedMaxUsersLabel(selectedMaxUsers),
        CallbackData.NEW_SERVICE_PANEL_VOLUME_USERS_DISPLAY,
      )
      .primary()
      .text("افزایش", panelVolumeUsersIncCallback(selectedCount, selectedMaxUsers, selectedDays))
      .icon(PremiumEmoji.VOLUME_INCREASE.id)
      .row()
      .text("کاهش", panelVolumeDaysDecCallback(selectedCount, selectedMaxUsers, selectedDays))
      .icon(PremiumEmoji.VOLUME_DECREASE.id)
      .text(formatPanelUnlimitedDaysLabel(selectedDays), CallbackData.NEW_SERVICE_PANEL_VOLUME_DAYS_DISPLAY)
      .primary()
      .text("افزایش", panelVolumeDaysIncCallback(selectedCount, selectedMaxUsers, selectedDays))
      .icon(PremiumEmoji.VOLUME_INCREASE.id)
      .row();

    if (
      !canIncrease ||
      !canDecrease ||
      !canIncreaseUsers ||
      !canDecreaseUsers ||
      !canIncreaseDays ||
      !canDecreaseDays
    ) {
      // grammy does not disable buttons; screen rebuild clamps values on click.
    }

    if (canContinue) {
      keyboard
        .text(
          "تایید و ادامه خرید",
          panelVolumeContinueCallback(selectedCount, selectedMaxUsers, selectedDays),
        )
        .icon(PremiumEmoji.SERVICE_PANEL_BTN.id)
        .success()
        .row();
    }
  }

  return keyboard
    .text("بازگشت", CallbackData.NEW_SERVICE_PANEL)
    .icon(PremiumEmoji.BACK_MENU.id);
}
