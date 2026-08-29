import { CallbackData } from "../constants/callbacks.js";
import { PremiumEmoji } from "../constants/emojis.js";
import { formatPanelUnlimitedCountText } from "../lib/panel-unlimited-steps.js";
import { formatPanelUnlimitedDaysText } from "../lib/panel-unlimited-days-steps.js";
import { formatPanelUnlimitedMaxUsersText } from "../lib/panel-unlimited-users-steps.js";
import { buildPanelAdminSuccessGlassKeyboard } from "./panel-admin-glass.keyboard.js";

export { panelUnlimitedPromptKeyboard } from "./panel-unlimited-prompt.keyboard.js";

export function panelUnlimitedSuccessKeyboard({
  username,
  password,
  panelUrl,
  count,
  maxUsers,
  days,
}) {
  return buildPanelAdminSuccessGlassKeyboard({
    username,
    password,
    panelUrl,
    statRows: [
      {
        label: "تعداد اشتراک",
        value: formatPanelUnlimitedCountText(count),
        icon: PremiumEmoji.VOLUME_PACKAGE.id,
      },
      {
        label: "سقف کاربر",
        value: formatPanelUnlimitedMaxUsersText(maxUsers),
        icon: PremiumEmoji.SERVICE_OUTBOUND_BTN.id,
      },
      {
        label: "مدت اشتراک",
        value: formatPanelUnlimitedDaysText(days),
        icon: PremiumEmoji.STATS_UPDATED.id,
      },
    ],
    backCallback: CallbackData.NEW_SERVICE_PANEL,
    backLabel: "بازگشت به پنل",
  });
}
