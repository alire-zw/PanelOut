import { InlineKeyboard } from "grammy";
import {
  CallbackData,
  adminChannelDetailCallback,
  adminChannelListPageCallback,
} from "../constants/callbacks.js";
import { AdminEmoji } from "../constants/emojis.js";

const LIST_PAGE_SIZE = 5;
const MAX_BUTTON_TEXT = 18;

function truncateText(text, maxLen = MAX_BUTTON_TEXT) {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, Math.max(1, maxLen - 3))}...`;
}

function headerButton(keyboard, text, icon) {
  keyboard.text(text, CallbackData.ADMIN_CHANNELS_DISPLAY).icon(icon);
}

export function adminChannelsHubKeyboard() {
  return new InlineKeyboard()
    .text("افزودن کانال", CallbackData.ADMIN_CHANNELS_ADD)
    .icon(AdminEmoji.ADD.id)
    .text("مشاهده کانال‌ها", CallbackData.ADMIN_CHANNELS_LIST)
    .icon(AdminEmoji.LIST.id)
    .row()
    .text("بازگشت به پنل ادمین", CallbackData.ADMIN_BACK)
    .icon(AdminEmoji.BACK.id);
}

export function adminChannelsListKeyboard(channels, page = 0) {
  const keyboard = new InlineKeyboard();
  const totalCount = channels.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / LIST_PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const start = safePage * LIST_PAGE_SIZE;
  const slice = channels.slice(start, start + LIST_PAGE_SIZE);

  if (slice.length > 0) {
    keyboard
      .text("قفل", CallbackData.ADMIN_CHANNELS_DISPLAY)
      .icon(AdminEmoji.STATUS.id)
      .text("اعضا", CallbackData.ADMIN_CHANNELS_DISPLAY)
      .icon(AdminEmoji.LIST.id)
      .text("کانال", CallbackData.ADMIN_CHANNELS_DISPLAY)
      .icon(AdminEmoji.CHANNELS.id)
      .row();

    for (const channel of slice) {
      const detailCb = adminChannelDetailCallback(String(channel.channelId));
      const lockText = channel.isLocked ? "قفل" : "باز";

      keyboard.text(lockText, detailCb);

      if (channel.isLocked) keyboard.danger();
      else keyboard.success();

      keyboard
        .text(String(channel.memberCount), detailCb)
        .text(truncateText(channel.channelName), detailCb)
        .row();
    }

    if (totalPages > 1) {
      if (safePage > 0) {
        keyboard
          .text("قبلی", adminChannelListPageCallback(safePage - 1))
          .icon(AdminEmoji.PREV.id);
      }

      keyboard.text(`صفحه ${safePage + 1}/${totalPages}`, CallbackData.ADMIN_CHANNELS_DISPLAY);

      if (safePage < totalPages - 1) {
        keyboard
          .text("بعدی", adminChannelListPageCallback(safePage + 1))
          .icon(AdminEmoji.NEXT.id);
      }

      keyboard.row();
    }
  }

  keyboard
    .text("افزودن کانال", CallbackData.ADMIN_CHANNELS_ADD)
    .icon(AdminEmoji.ADD.id)
    .row()
    .text("بازگشت", CallbackData.ADMIN_CHANNELS)
    .icon(AdminEmoji.BACK.id);

  return { keyboard, page: safePage, totalPages };
}

export function adminChannelDetailKeyboard(channel) {
  const keyboard = new InlineKeyboard();
  const id = String(channel.channelId);
  const lockLabel = channel.isLocked ? "باز کردن قفل" : "قفل کردن";

  headerButton(keyboard, "نام کانال", AdminEmoji.TITLE.id);
  headerButton(keyboard, "یوزرنیم", AdminEmoji.EDIT.id);
  keyboard.row();
  keyboard
    .text(truncateText(channel.channelName), CallbackData.ADMIN_CHANNELS_DISPLAY)
    .text(
      truncateText(channel.channelUsername ? `@${channel.channelUsername}` : "—"),
      CallbackData.ADMIN_CHANNELS_DISPLAY,
    );
  keyboard.row();

  headerButton(keyboard, "آیدی", AdminEmoji.CONNECTION.id);
  headerButton(keyboard, "اعضا", AdminEmoji.LIST.id);
  keyboard.row();
  keyboard
    .text(String(channel.channelId), CallbackData.ADMIN_CHANNELS_DISPLAY)
    .text(String(channel.memberCount), CallbackData.ADMIN_CHANNELS_DISPLAY);
  keyboard.row();

  headerButton(keyboard, "لیبل دکمه", AdminEmoji.SETTINGS.id);
  headerButton(keyboard, "وضعیت قفل", AdminEmoji.STATUS.id);
  keyboard.row();
  keyboard
    .text(truncateText(channel.buttonLabel || "تایید عضویت"), adminChannelEditLabelCallback(id))
    .text(channel.isLocked ? "قفل" : "باز", adminChannelToggleLockCallback(id));

  if (channel.isLocked) keyboard.danger();
  else keyboard.success();

  keyboard.row();

  keyboard
    .text(lockLabel, adminChannelToggleLockCallback(id))
    .icon(channel.isLocked ? AdminEmoji.ACTIVE.id : AdminEmoji.STATUS.id)
    .row()
    .text("ویرایش لیبل", adminChannelEditLabelCallback(id))
    .icon(AdminEmoji.EDIT.id)
    .row()
    .text("حذف کانال", adminChannelDeleteCallback(id))
    .icon(AdminEmoji.DELETE.id)
    .row()
    .text("بازگشت به لیست", CallbackData.ADMIN_CHANNELS_LIST)
    .icon(AdminEmoji.BACK.id);

  return keyboard;
}

export function adminChannelDeleteConfirmKeyboard(channelId) {
  const id = String(channelId);

  return new InlineKeyboard()
    .text("بله، حذف شود", adminChannelDeleteConfirmCallback(id))
    .danger()
    .row()
    .text("انصراف", adminChannelDetailCallback(id))
    .icon(AdminEmoji.BACK.id);
}

export function adminChannelAddCancelKeyboard() {
  return new InlineKeyboard()
    .text("انصراف", CallbackData.ADMIN_CHANNELS_ADD_CANCEL)
    .icon(AdminEmoji.BACK.id);
}

export function adminChannelAddSuccessKeyboard() {
  return new InlineKeyboard()
    .text("افزودن کانال دیگر", CallbackData.ADMIN_CHANNELS_ADD)
    .icon(AdminEmoji.ADD.id)
    .text("مشاهده کانال‌ها", CallbackData.ADMIN_CHANNELS_LIST)
    .icon(AdminEmoji.LIST.id)
    .row()
    .text("بازگشت", CallbackData.ADMIN_CHANNELS)
    .icon(AdminEmoji.BACK.id);
}

export function adminChannelAddExistsKeyboard() {
  return new InlineKeyboard()
    .text("بازگشت", CallbackData.ADMIN_CHANNELS)
    .icon(AdminEmoji.BACK.id);
}

export function adminChannelEditLabelCancelKeyboard(channelId) {
  return new InlineKeyboard()
    .text("انصراف", adminChannelDetailCallback(String(channelId)))
    .icon(AdminEmoji.BACK.id);
}

function adminChannelEditLabelCallback(channelId) {
  return `${CallbackData.ADMIN_CHANNEL_EDIT_LABEL_PREFIX}${channelId}`;
}

function adminChannelToggleLockCallback(channelId) {
  return `${CallbackData.ADMIN_CHANNEL_TOGGLE_LOCK_PREFIX}${channelId}`;
}

function adminChannelDeleteCallback(channelId) {
  return `${CallbackData.ADMIN_CHANNEL_DELETE_PREFIX}${channelId}`;
}

function adminChannelDeleteConfirmCallback(channelId) {
  return `${CallbackData.ADMIN_CHANNEL_DELETE_CONFIRM_PREFIX}${channelId}`;
}
