import { InlineKeyboard } from "grammy";
import { CallbackData } from "../constants/callbacks.js";
import { PremiumEmoji } from "../constants/emojis.js";
import { PANEL_TRIAL_VOLUME_GB } from "../constants/service-types.js";
import { buildPanelAdminSuccessGlassKeyboard } from "./panel-admin-glass.keyboard.js";

export function panelTrialPromptKeyboard() {
  return new InlineKeyboard()
    .text("انصراف", CallbackData.NEW_SERVICE_PANEL)
    .icon(PremiumEmoji.CANCEL.id);
}

export function panelTrialSuccessKeyboard({ username, password, panelUrl }) {
  return buildPanelAdminSuccessGlassKeyboard({
    username,
    password,
    panelUrl,
    statRows: [
      {
        label: "حجم تست",
        value: `${PANEL_TRIAL_VOLUME_GB} گیگابایت`,
        icon: PremiumEmoji.VOLUME_PACKAGE.id,
      },
    ],
    backCallback: CallbackData.NEW_SERVICE_PANEL,
    backLabel: "بازگشت",
  });
}
