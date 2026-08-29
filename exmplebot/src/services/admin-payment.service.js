import {
  adminPaymentMainKeyboard,
  adminRialSettingsKeyboard,
  adminTronSettingsKeyboard,
} from "../keyboards/admin-payment.keyboard.js";
import {
  buildAdminPaymentSettingsMessage,
  buildAdminRialSettingsMessage,
  buildAdminTronSettingsMessage,
} from "../messages/admin-payment.message.js";
import { formatJalaliDateTime } from "../lib/tehran-time.js";
import { getPaymentSettings } from "./payment-settings.service.js";

async function buildScreen(messageBuilder, keyboardBuilder) {
  const settings = await getPaymentSettings();
  const updatedAt = formatJalaliDateTime(settings.dateUpdated);

  return {
    text: messageBuilder(updatedAt),
    keyboard: keyboardBuilder(settings),
  };
}

export async function buildAdminPaymentSettingsScreen() {
  return buildScreen(
    buildAdminPaymentSettingsMessage,
    () => adminPaymentMainKeyboard(),
  );
}

export async function buildAdminTronSettingsScreen() {
  return buildScreen(buildAdminTronSettingsMessage, adminTronSettingsKeyboard);
}

export async function buildAdminRialSettingsScreen() {
  return buildScreen(buildAdminRialSettingsMessage, adminRialSettingsKeyboard);
}
