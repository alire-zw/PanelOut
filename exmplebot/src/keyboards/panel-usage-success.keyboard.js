import { CallbackData } from "../constants/callbacks.js";
import { PremiumEmoji } from "../constants/emojis.js";
import { buildPanelAdminSuccessGlassKeyboard } from "./panel-admin-glass.keyboard.js";

export function panelUsageSuccessKeyboard({ username, password, panelUrl }) {
  return buildPanelAdminSuccessGlassKeyboard({
    username,
    password,
    panelUrl,
    backCallback: CallbackData.NEW_SERVICE_PANEL,
    backLabel: "بازگشت به پنل",
  });
}
