import { adminPricingSettingsKeyboard } from "../keyboards/admin-pricing-settings.keyboard.js";
import { buildAdminPricingSettingsMessage } from "../messages/admin-pricing-settings.message.js";
import { getSubscriptionPricing } from "./subscription-pricing.service.js";

export async function buildAdminPricingSettingsScreen() {
  const pricing = await getSubscriptionPricing();
  const updatedAt = pricing.dateUpdated instanceof Date ? pricing.dateUpdated : new Date();

  return {
    text: buildAdminPricingSettingsMessage({
      ...pricing,
      updatedAt,
    }),
    keyboard: adminPricingSettingsKeyboard(),
  };
}
