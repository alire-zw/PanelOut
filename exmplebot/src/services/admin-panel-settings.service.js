import { adminPanelSettingsKeyboard } from "../keyboards/admin-panel-settings.keyboard.js";
import { buildAdminPanelSettingsMessage } from "../messages/admin-panel-settings.message.js";
import { getPanelUnlimitedAvailability } from "./panel-settings.service.js";

export async function buildAdminPanelSettingsScreen() {
  const availability = await getPanelUnlimitedAvailability();
  const updatedAt = availability.dateUpdated ?? new Date();

  return {
    text: buildAdminPanelSettingsMessage({
      capacity: availability.capacity,
      sold: availability.sold,
      remaining: availability.remaining,
      updatedAt,
    }),
    keyboard: adminPanelSettingsKeyboard(),
  };
}
