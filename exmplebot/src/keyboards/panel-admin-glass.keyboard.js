import { InlineKeyboard } from "grammy";
import { CallbackData } from "../constants/callbacks.js";
import { PremiumEmoji } from "../constants/emojis.js";
import {
  appendGlassCopyPairRows,
  appendGlassFullUrlRow,
  appendGlassValueBeforeLabelRow,
} from "../lib/glass-keyboard.js";

const GLASS_DISPLAY = CallbackData.PANEL_ADMIN_GLASS_DISPLAY;

function appendPanelAdminCredentialRows(keyboard, { username, password, panelUrl, displayCb }) {
  appendGlassCopyPairRows(keyboard, {
    leftLabel: "یوزرنیم",
    rightLabel: "رمز عبور",
    leftIcon: PremiumEmoji.NERD.id,
    rightIcon: PremiumEmoji.PAYMENT_TRON.id,
    leftValue: username,
    rightValue: password || "—",
    leftCopy: username || null,
    rightCopy: password || null,
    displayCb,
  });

  appendGlassFullUrlRow(keyboard, {
    text: "ورود به پنل",
    url: panelUrl,
    displayCb,
  });
}

export function buildPanelUsageActiveGlassKeyboard({
  username,
  password,
  panelUrl,
  usedLabel,
  statusLabel,
}) {
  const keyboard = new InlineKeyboard();

  appendPanelAdminCredentialRows(keyboard, {
    username,
    password,
    panelUrl,
    displayCb: GLASS_DISPLAY,
  });

  appendGlassValueBeforeLabelRow(keyboard, {
    value: usedLabel,
    label: "مصرف",
    icon: PremiumEmoji.VOLUME_PACKAGE.id,
    displayCb: GLASS_DISPLAY,
  });

  appendGlassValueBeforeLabelRow(keyboard, {
    value: statusLabel,
    label: "وضعیت",
    icon: PremiumEmoji.SERVICE_ACTIVE.id,
    displayCb: GLASS_DISPLAY,
  });

  keyboard
    .text("بازگشت", CallbackData.NEW_SERVICE_PANEL)
    .icon(PremiumEmoji.BACK_MENU.id)
    .text("منوی اصلی", CallbackData.BACK_TO_MENU)
    .icon(PremiumEmoji.BACK_MENU.id);

  return keyboard;
}

export function buildPanelAdminSuccessGlassKeyboard({
  username,
  password,
  panelUrl,
  statRows = [],
  backCallback = CallbackData.NEW_SERVICE_PANEL,
  backLabel = "بازگشت به پنل",
}) {
  const keyboard = new InlineKeyboard();

  appendPanelAdminCredentialRows(keyboard, {
    username,
    password,
    panelUrl,
    displayCb: GLASS_DISPLAY,
  });

  for (const row of statRows) {
    appendGlassValueBeforeLabelRow(keyboard, {
      value: row.value,
      label: row.label,
      icon: row.icon,
      displayCb: GLASS_DISPLAY,
      tone: row.tone ?? null,
    });
  }

  keyboard.text(backLabel, backCallback).icon(PremiumEmoji.BACK_MENU.id);

  return keyboard;
}

export function appendManageServicePanelAdminGlassRows(
  keyboard,
  { username, password, panelUrl },
) {
  appendPanelAdminCredentialRows(keyboard, {
    username,
    password,
    panelUrl,
    displayCb: CallbackData.MANAGE_SERVICES_DISPLAY,
  });
}
