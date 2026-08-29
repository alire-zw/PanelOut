import { AdminEmoji, adminEmoji } from "../constants/emojis.js";

export function buildAdminChannelsHubMessage(updatedAt) {
  return [
    `${adminEmoji(AdminEmoji.CHANNELS)} <b>مدیریت کانال‌ها</b>`,
    "",
    "کانال‌های اجباری ربات را از این بخش مدیریت کنید. کانال‌هایی که قفل هستند، برای استفاده از ربات باید عضو آن‌ها باشید.",
    "",
    `${adminEmoji(AdminEmoji.REFRESH)} آخرین بروزرسانی: ${updatedAt}.`,
  ].join("\n");
}

export function buildAdminChannelsListMessage(updatedAt, totalCount) {
  const lines = [
    `${adminEmoji(AdminEmoji.LIST)} <b>لیست کانال‌ها</b>`,
    "",
  ];

  if (totalCount === 0) {
    lines.push("هنوز <b>کانالی</b> ثبت نشده است. از دکمه «افزودن کانال» یک کانال اضافه کنید.");
  } else {
    lines.push(
      `لیست <b>${totalCount}</b> کانال. وضعیت قفل هر کانال در دکمه‌های زیر نمایش داده می‌شود.`,
    );
  }

  lines.push("", `${adminEmoji(AdminEmoji.REFRESH)} آخرین بروزرسانی: ${updatedAt}.`);

  return lines.join("\n");
}

export function buildAdminChannelAddPromptMessage() {
  return [
    `${adminEmoji(AdminEmoji.ADD)} <b>افزودن کانال</b>`,
    "",
    "یک یا چند پیام از کانال مورد نظر را به ربات <b>Forward</b> کنید.",
    "",
    "<b>نکات مهم:</b>",
    "• ربات باید در کانال <b>ادمین</b> باشد",
    "• پیام باید از کانال باشد (نه گروه یا چت خصوصی)",
    "• برای لغو، روی دکمه انصراف کلیک کنید",
  ].join("\n");
}

export function buildAdminChannelDetailMessage(channel, memberCount, updatedAt) {
  const username = channel.channelUsername ? `@${channel.channelUsername}` : "ندارد";
  const lockText = channel.isLocked ? "قفل (اجباری)" : "باز";

  return [
    `${adminEmoji(AdminEmoji.DETAIL)} <b>جزئیات کانال</b>`,
    "",
    `${adminEmoji(AdminEmoji.TITLE)} نام: <b>${channel.channelName}</b>`,
    `${adminEmoji(AdminEmoji.EDIT)} یوزرنیم: <b>${username}</b>`,
    `${adminEmoji(AdminEmoji.CONNECTION)} آیدی: <code>${channel.channelId}</code>`,
    `${adminEmoji(AdminEmoji.STATUS)} وضعیت قفل: <b>${lockText}</b>`,
    `${adminEmoji(AdminEmoji.LIST)} تعداد اعضا: <b>${memberCount.toLocaleString("en-US")}</b>`,
    `${adminEmoji(AdminEmoji.SETTINGS)} لیبل دکمه: <b>${channel.buttonLabel || "تایید عضویت"}</b>`,
    "",
    `${adminEmoji(AdminEmoji.REFRESH)} آخرین بروزرسانی: ${updatedAt}.`,
  ].join("\n");
}

export function buildAdminChannelDeleteConfirmMessage(channel) {
  const username = channel.channelUsername ? `@${channel.channelUsername}` : "ندارد";

  return [
    `${adminEmoji(AdminEmoji.DELETE)} <b>حذف کانال</b>`,
    "",
    `${adminEmoji(AdminEmoji.TITLE)} کانال: <b>${channel.channelName}</b>`,
    `${adminEmoji(AdminEmoji.EDIT)} یوزرنیم: <b>${username}</b>`,
    `${adminEmoji(AdminEmoji.CONNECTION)} آیدی: <code>${channel.channelId}</code>`,
    "",
    "آیا مطمئن هستید که می‌خواهید این کانال را حذف کنید؟",
  ].join("\n");
}

export function buildAdminChannelAddSuccessMessage(channel, memberCount) {
  const username = channel.channelUsername ? `@${channel.channelUsername}` : "ندارد";

  return [
    `${adminEmoji(AdminEmoji.CONFIRM)} <b>کانال با موفقیت اضافه شد</b>`,
    "",
    `${adminEmoji(AdminEmoji.TITLE)} نام: <b>${channel.channelName}</b>`,
    `${adminEmoji(AdminEmoji.EDIT)} یوزرنیم: <b>${username}</b>`,
    `${adminEmoji(AdminEmoji.CONNECTION)} آیدی: <code>${channel.channelId}</code>`,
    `${adminEmoji(AdminEmoji.LIST)} تعداد اعضا: <b>${memberCount.toLocaleString("en-US")}</b>`,
  ].join("\n");
}

export function buildAdminChannelAddExistsMessage(channel) {
  const username = channel.channelUsername ? `@${channel.channelUsername}` : "ندارد";

  return [
    `${adminEmoji(AdminEmoji.NOTIFY)} <b>کانال از قبل موجود است</b>`,
    "",
    `${adminEmoji(AdminEmoji.TITLE)} نام: <b>${channel.channelName}</b>`,
    `${adminEmoji(AdminEmoji.EDIT)} یوزرنیم: <b>${username}</b>`,
    `${adminEmoji(AdminEmoji.CONNECTION)} آیدی: <code>${channel.channelId}</code>`,
  ].join("\n");
}

export function buildAdminChannelEditLabelPromptMessage(channel) {
  return [
    `${adminEmoji(AdminEmoji.EDIT)} <b>ویرایش لیبل دکمه</b>`,
    "",
    `${adminEmoji(AdminEmoji.TITLE)} کانال: <b>${channel.channelName}</b>`,
    `${adminEmoji(AdminEmoji.SETTINGS)} لیبل فعلی: <b>${channel.buttonLabel || "تایید عضویت"}</b>`,
    "",
    "لیبل جدید دکمه عضویت را ارسال کنید:",
  ].join("\n");
}

export function buildAdminChannelForwardInvalidMessage() {
  return `${adminEmoji(AdminEmoji.NOTIFY)} <b>این پیام از یک کانال نیست.</b> لطفاً یک پیام از کانال را Forward کنید.`;
}
