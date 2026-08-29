import { InlineKeyboard } from "grammy";
import {
  CallbackData,
  manageServicesBackCallback,
  manageServicesDetailCallback,
  manageServicesDetailRefreshCallback,
  manageServicesPageCallback,
  manageServicesRefreshCallback,
  manageServicesToggleCallback,
} from "../constants/callbacks.js";
import { ServiceType } from "../constants/service-types.js";
import { MANAGE_SERVICES_LIST_COLS } from "../constants/manage-services.js";
import { PremiumEmoji } from "../constants/emojis.js";
import { buildPasarGuardBaseUrl } from "../services/pasarguard.service.js";
import { buildServiceListButtonLabel } from "../lib/manage-services-format.js";
import { appendManageServicePanelAdminGlassRows } from "./panel-admin-glass.keyboard.js";
import { appendGlassValueBeforeLabelRow } from "../lib/glass-keyboard.js";
import {
  getListButtonStyle,
  getToggleButtonLabel,
  resolveManageServiceStatus,
  resolveManageServiceToggleAction,
} from "../lib/manage-services-status.js";
import { appendBackToMenuRow } from "./back.keyboard.js";

export function manageServicesProcessingKeyboard() {
  return new InlineKeyboard();
}

export function manageServicesDetailProcessingKeyboard() {
  return new InlineKeyboard();
}

function chunkArray(items, size) {
  const rows = [];

  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }

  return rows;
}

function appendServiceButton(keyboard, subscription, live, page) {
  const status = resolveManageServiceStatus(subscription, live);
  const style = getListButtonStyle(status);
  const detailCb = manageServicesDetailCallback(String(subscription.id), page);
  const label = buildServiceListButtonLabel(subscription);

  if (style === "success") {
    keyboard.text(label, detailCb).success();
    return;
  }

  if (style === "danger") {
    keyboard.text(label, detailCb).danger();
    return;
  }

  keyboard.text(label, detailCb);
}

function appendPaginationRow(keyboard, { page, totalPages }) {
  if (totalPages <= 1) {
    return;
  }

  if (page > 0) {
    keyboard
      .text("قبلی", manageServicesPageCallback(page - 1))
      .icon(PremiumEmoji.BACK_MENU.id);
  }

  keyboard.text(`صفحه ${page + 1}/${totalPages}`, CallbackData.MANAGE_SERVICES_DISPLAY);

  if (page < totalPages - 1) {
    keyboard
      .text("بعدی", manageServicesPageCallback(page + 1))
      .icon(PremiumEmoji.MANAGE_SERVICES.id);
  }

  keyboard.row();
}

export function manageServicesListKeyboard(pageItems, { page = 0, totalPages = 1 } = {}) {
  const keyboard = new InlineKeyboard();

  if (pageItems.length > 0) {
    const rows = chunkArray(pageItems, MANAGE_SERVICES_LIST_COLS);

    for (const row of rows) {
      for (const { subscription, live } of row) {
        appendServiceButton(keyboard, subscription, live, page);
      }
      keyboard.row();
    }
  }

  appendPaginationRow(keyboard, { page, totalPages });

  keyboard
    .text("بروزرسانی", manageServicesRefreshCallback(page))
    .icon(PremiumEmoji.STATS_UPDATED.id)
    .row();

  appendBackToMenuRow(keyboard);

  return keyboard;
}

export function manageServicesDetailKeyboard({
  subscription,
  live,
  listPage = 0,
  stats = {},
  credentials = {},
}) {
  const keyboard = new InlineKeyboard();
  const subscriptionId = String(subscription.id);
  const displayCb = CallbackData.MANAGE_SERVICES_DISPLAY;
  const refreshCb = manageServicesDetailRefreshCallback(subscriptionId, listPage);
  const status = resolveManageServiceStatus(subscription, live);
  const toggleAction = resolveManageServiceToggleAction(subscription, status);
  const toggleLabel = getToggleButtonLabel(toggleAction);
  const isPanelAdmin =
    subscription.serviceType === ServiceType.PANEL_TRIAL ||
    subscription.serviceType === ServiceType.PANEL_UNLIMITED ||
    subscription.serviceType === ServiceType.PANEL_USAGE;

  if (isPanelAdmin) {
    const panelUrl =
      subscription.connectionLink ||
      `${buildPasarGuardBaseUrl(subscription.server)}/dashboard`;

    appendManageServicePanelAdminGlassRows(keyboard, {
      username: subscription.clientEmail,
      password: credentials.password,
      panelUrl,
    });
  }

  appendGlassValueBeforeLabelRow(keyboard, {
    value: stats.statusLabel || "—",
    label: "وضعیت",
    icon: PremiumEmoji.SERVICE_ACTIVE.id,
    displayCb,
  });

  keyboard
    .text("حجم / ظرفیت", displayCb)
    .icon(PremiumEmoji.VOLUME_PACKAGE.id)
    .text(stats.volumeLabel || "—", displayCb)
    .row();

  appendGlassValueBeforeLabelRow(keyboard, {
    value: stats.usedLabel || "—",
    label: "مصرف",
    icon: PremiumEmoji.STATS_DESC.id,
    displayCb,
  });

  if (toggleLabel) {
    const toggleCb = manageServicesToggleCallback(subscriptionId, listPage);
    const toggleBtn = keyboard.text(toggleLabel, toggleCb);

    if (
      toggleAction === "deactivate_usage" ||
      toggleAction === "deactivate_panel_usage" ||
      toggleAction === "disable_volume" ||
      toggleAction === "disable_admin"
    ) {
      toggleBtn.danger();
    } else {
      toggleBtn.success();
    }

    keyboard.row();
  }

  keyboard
    .text("بروزرسانی", refreshCb)
    .icon(PremiumEmoji.STATS_UPDATED.id)
    .row()
    .text("بازگشت به لیست", manageServicesBackCallback(listPage))
    .icon(PremiumEmoji.BACK_MENU.id)
    .row();

  return keyboard;
}

export function manageServicesEmptyKeyboard() {
  const keyboard = new InlineKeyboard();

  keyboard
    .text("تهیه سرویس جدید", CallbackData.NEW_SERVICE)
    .icon(PremiumEmoji.NEW_SERVICE.id)
    .row();

  appendBackToMenuRow(keyboard);

  return keyboard;
}
