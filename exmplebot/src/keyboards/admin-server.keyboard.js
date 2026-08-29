import { InlineKeyboard } from "grammy";
import {
  CallbackData,
  adminServerDetailCallback,
  adminServerListPageCallback,
} from "../constants/callbacks.js";
import { AdminEmoji } from "../constants/emojis.js";
import {
  formatBytes,
  isServerActive,
  isServerOutboundUsageEnabled,
  isServerOutboundVolumeEnabled,
  isServerPanelUnlimitedEnabled,
  isServerPanelUsageEnabled,
  isServerPanelVolumeEnabled,
  isServerRenewalEnabled,
  isServerSalesEnabled,
} from "../services/server.service.js";

const LIST_PAGE_SIZE = 5;
const MAX_BUTTON_TEXT = 18;

function truncateText(text, maxLen = MAX_BUTTON_TEXT) {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, Math.max(1, maxLen - 3))}...`;
}

function headerButton(keyboard, text, icon) {
  keyboard.text(text, CallbackData.ADMIN_SERVERS_DISPLAY).icon(icon);
}

function featureStatusLabel(enabled) {
  return enabled ? "فعال" : "غیرفعال";
}

function appendFeatureToggleRow(keyboard, label, kind, enabled, serverId) {
  keyboard
    .text(label, CallbackData.ADMIN_SERVERS_DISPLAY)
    .text(featureStatusLabel(enabled), adminServerToggleCallback(kind, serverId));

  if (enabled) keyboard.success();
  else keyboard.danger();

  keyboard.row();
}

export function adminServersHubKeyboard() {
  return new InlineKeyboard()
    .text("افزودن سرور", CallbackData.ADMIN_SERVERS_ADD)
    .icon(AdminEmoji.ADD.id)
    .text("مشاهده سرورها", CallbackData.ADMIN_SERVERS_LIST)
    .icon(AdminEmoji.LIST.id)
    .row()
    .text("بازگشت به پنل ادمین", CallbackData.ADMIN_BACK)
    .icon(AdminEmoji.BACK.id);
}

export function adminServersListKeyboard(servers, connectionResults, page = 0) {
  const keyboard = new InlineKeyboard();
  const totalCount = servers.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / LIST_PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const start = safePage * LIST_PAGE_SIZE;
  const slice = servers.slice(start, start + LIST_PAGE_SIZE);

  if (slice.length > 0) {
    keyboard
      .text("وضعیت", CallbackData.ADMIN_SERVERS_DISPLAY)
      .icon(AdminEmoji.STATUS.id)
      .text("پورت", CallbackData.ADMIN_SERVERS_DISPLAY)
      .icon(AdminEmoji.PORT.id)
      .text("سرور", CallbackData.ADMIN_SERVERS_DISPLAY)
      .icon(AdminEmoji.SERVERS.id)
      .row();

    for (let i = 0; i < slice.length; i++) {
      const server = slice[i];
      const conn = connectionResults[i];
      const connectionStatus =
        conn === undefined ? "بررسی..." : conn.success ? "متصل" : "قطع";
      const detailCb = adminServerDetailCallback(server.id);

      keyboard.text(connectionStatus, detailCb);

      if (conn?.success) keyboard.success();
      else if (conn !== undefined) keyboard.danger();

      keyboard
        .text(String(server.port), detailCb)
        .text(truncateText(`[PG] ${server.serverName}`), detailCb)
        .row();
    }

    if (totalPages > 1) {
      if (safePage > 0) {
        keyboard
          .text("قبلی", adminServerListPageCallback(safePage - 1))
          .icon(AdminEmoji.PREV.id);
      }

      keyboard.text(`صفحه ${safePage + 1}/${totalPages}`, CallbackData.ADMIN_SERVERS_DISPLAY);

      if (safePage < totalPages - 1) {
        keyboard
          .text("بعدی", adminServerListPageCallback(safePage + 1))
          .icon(AdminEmoji.NEXT.id);
      }

      keyboard.row();
    }
  }

  keyboard
    .text("افزودن سرور", CallbackData.ADMIN_SERVERS_ADD)
    .icon(AdminEmoji.ADD.id)
    .row()
    .text("بروزرسانی لیست", CallbackData.ADMIN_SERVERS_LIST)
    .icon(AdminEmoji.REFRESH.id)
    .row()
    .text("بازگشت", CallbackData.ADMIN_SERVERS)
    .icon(AdminEmoji.BACK.id);

  return { keyboard, page: safePage, totalPages };
}

export function adminServerDetailKeyboard(server, stats, connectionResult) {
  const keyboard = new InlineKeyboard();
  const id = String(server.id);
  const connText = connectionResult?.success ? "متصل" : "قطع";

  headerButton(keyboard, "نام سرور", AdminEmoji.TITLE.id);
  headerButton(keyboard, "IP", AdminEmoji.CONNECTION.id);
  keyboard.row();
  keyboard
    .text(truncateText(server.serverName), adminServerEditCallback("serverName", id))
    .text(truncateText(server.serverIp), adminServerEditCallback("serverIp", id));
  keyboard.row();

  headerButton(keyboard, "دامنه/URL", AdminEmoji.DETAIL.id);
  headerButton(keyboard, "پورت", AdminEmoji.PORT.id);
  keyboard.row();
  keyboard
    .text(
      truncateText(server.serverDomain || "—"),
      adminServerEditCallback("serverDomain", id),
    )
    .text(String(server.port), adminServerEditCallback("port", id));
  keyboard.row();

  headerButton(keyboard, "Remark", AdminEmoji.EDIT.id);
  headerButton(keyboard, "لینک ساب", AdminEmoji.MASTER.id);
  keyboard.row();
  keyboard
    .text(truncateText(server.remark || "—"), adminServerEditCallback("remark", id))
    .text(
      truncateText(server.subPublicBaseUrl || "—"),
      adminServerEditCallback("subPublicBaseUrl", id),
    );
  keyboard.row();

  headerButton(keyboard, "کاربران", AdminEmoji.LIST.id);
  headerButton(keyboard, "آنلاین", AdminEmoji.ACTIVE.id);
  headerButton(keyboard, "اتصال", AdminEmoji.STATUS.id);
  keyboard.row();
  keyboard
    .text(stats ? String(stats.totalClients) : "—", CallbackData.ADMIN_SERVERS_DISPLAY)
    .text(stats ? String(stats.onlineClients) : "—", CallbackData.ADMIN_SERVERS_DISPLAY)
    .text(connText, CallbackData.ADMIN_SERVERS_DISPLAY);

  if (connectionResult?.success) keyboard.success();
  else keyboard.danger();

  keyboard.row();

  headerButton(keyboard, "آپلود", AdminEmoji.UPLOAD.id);
  headerButton(keyboard, "دانلود", AdminEmoji.DOWNLOAD.id);
  headerButton(keyboard, "کل ترافیک", AdminEmoji.TRAFFIC.id);
  keyboard.row();
  keyboard
    .text(stats ? formatBytes(stats.totalUpload) : "—", CallbackData.ADMIN_SERVERS_DISPLAY)
    .text(stats ? formatBytes(stats.totalDownload) : "—", CallbackData.ADMIN_SERVERS_DISPLAY)
    .text(stats ? formatBytes(stats.totalTraffic) : "—", CallbackData.ADMIN_SERVERS_DISPLAY);
  keyboard.row();

  const activeLabel = isServerActive(server) ? "غیرفعال کردن" : "فعال کردن";
  keyboard
    .text(activeLabel, adminServerToggleCallback("active", id))
    .icon(AdminEmoji.ACTIVE.id)
    .row();

  const salesLabel = isServerSalesEnabled(server) ? "بستن فروش" : "باز کردن فروش";
  keyboard
    .text(salesLabel, adminServerToggleCallback("sales", id))
    .icon(AdminEmoji.SALES.id)
    .row();

  const renewalLabel = isServerRenewalEnabled(server) ? "غیرفعال تمدید" : "فعال تمدید";
  keyboard
    .text(renewalLabel, adminServerToggleCallback("renewal", id))
    .icon(AdminEmoji.RENEWAL.id)
    .row();

  headerButton(keyboard, "بخش اوتباند", AdminEmoji.SERVERS.id);
  headerButton(keyboard, "وضعیت", AdminEmoji.STATUS.id);
  keyboard.row();

  appendFeatureToggleRow(
    keyboard,
    "حجمی",
    "outboundVolume",
    isServerOutboundVolumeEnabled(server),
    id,
  );
  appendFeatureToggleRow(
    keyboard,
    "به ازای مصرف",
    "outboundUsage",
    isServerOutboundUsageEnabled(server),
    id,
  );

  headerButton(keyboard, "بخش پنل", AdminEmoji.PANEL.id);
  headerButton(keyboard, "وضعیت", AdminEmoji.STATUS.id);
  keyboard.row();

  appendFeatureToggleRow(
    keyboard,
    "حجمی",
    "panelVolume",
    isServerPanelVolumeEnabled(server),
    id,
  );
  appendFeatureToggleRow(
    keyboard,
    "به ازای مصرف",
    "panelUsage",
    isServerPanelUsageEnabled(server),
    id,
  );
  appendFeatureToggleRow(
    keyboard,
    "نامحدود",
    "panelUnlimited",
    isServerPanelUnlimitedEnabled(server),
    id,
  );

  keyboard
    .text("بروزرسانی آمار", adminServerRefreshCallback(id))
    .icon(AdminEmoji.REFRESH.id)
    .text("حذف سرور", adminServerDeleteCallback(id))
    .icon(AdminEmoji.DELETE.id)
    .row()
    .text("بازگشت به لیست", CallbackData.ADMIN_SERVERS_LIST)
    .icon(AdminEmoji.BACK.id);

  return keyboard;
}

export function adminServerDeleteConfirmKeyboard(serverId) {
  const id = String(serverId);

  return new InlineKeyboard()
    .text("بله، حذف شود", adminServerDeleteConfirmCallback(id))
    .danger()
    .row()
    .text("انصراف", adminServerDetailCallback(id))
    .icon(AdminEmoji.BACK.id);
}

export function adminServerAddCancelKeyboard() {
  return new InlineKeyboard()
    .text("انصراف", CallbackData.ADMIN_SERVERS_ADD_CANCEL)
    .icon(AdminEmoji.BACK.id);
}

export function adminServerAddSuccessKeyboard() {
  return new InlineKeyboard()
    .text("بازگشت به مدیریت سرورها", CallbackData.ADMIN_SERVERS)
    .icon(AdminEmoji.BACK.id);
}

export function adminServerAddFailedKeyboard() {
  return new InlineKeyboard()
    .text("افزودن مجدد", CallbackData.ADMIN_SERVERS_ADD)
    .icon(AdminEmoji.ADD.id)
    .row()
    .text("بازگشت به مدیریت سرورها", CallbackData.ADMIN_SERVERS)
    .icon(AdminEmoji.BACK.id);
}

export function adminServerEditCancelKeyboard(serverId) {
  return new InlineKeyboard()
    .text("انصراف", adminServerDetailCallback(serverId))
    .icon(AdminEmoji.BACK.id);
}

function adminServerEditCallback(field, serverId) {
  return `${CallbackData.ADMIN_SERVER_EDIT_PREFIX}${field}:${serverId}`;
}

function adminServerToggleCallback(kind, serverId) {
  return `${CallbackData.ADMIN_SERVER_TOGGLE_PREFIX}${kind}:${serverId}`;
}

function adminServerRefreshCallback(serverId) {
  return `${CallbackData.ADMIN_SERVER_REFRESH_PREFIX}${serverId}`;
}

function adminServerDeleteCallback(serverId) {
  return `${CallbackData.ADMIN_SERVER_DELETE_PREFIX}${serverId}`;
}

function adminServerDeleteConfirmCallback(serverId) {
  return `${CallbackData.ADMIN_SERVER_DELETE_CONFIRM_PREFIX}${serverId}`;
}
