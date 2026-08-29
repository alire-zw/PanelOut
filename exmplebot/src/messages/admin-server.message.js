import { AdminEmoji, adminEmoji } from "../constants/emojis.js";
import {
  isServerOutboundUsageEnabled,
  isServerOutboundVolumeEnabled,
  isServerPanelUnlimitedEnabled,
  isServerPanelUsageEnabled,
  isServerPanelVolumeEnabled,
} from "../services/server.service.js";

function featureStatusText(enabled) {
  return enabled ? "فعال" : "غیرفعال";
}

export function buildAdminServersHubMessage(updatedAt) {
  return [
    `${adminEmoji(AdminEmoji.SERVERS)} <b>مدیریت سرورها</b>`,
    "",
    "سرورهای PasarGuard ربات را از این بخش مدیریت کنید. برای افزودن سرور جدید یا مشاهده لیست، از دکمه‌های زیر استفاده کنید.",
    "",
    `${adminEmoji(AdminEmoji.REFRESH)} آخرین بروزرسانی: ${updatedAt}.`,
  ].join("\n");
}

export function buildAdminServersListMessage(updatedAt, totalCount) {
  const lines = [
    `${adminEmoji(AdminEmoji.LIST)} <b>لیست سرورها</b>`,
    "",
  ];

  if (totalCount === 0) {
    lines.push("هنوز <b>سروری</b> ثبت نشده است. از دکمه «افزودن سرور» یک پنل PasarGuard اضافه کنید.");
  } else {
    lines.push(
      `لیست <b>${totalCount}</b> سرور PasarGuard. وضعیت اتصال هر سرور در دکمه‌های زیر نمایش داده می‌شود.`,
    );
  }

  lines.push("", `${adminEmoji(AdminEmoji.REFRESH)} آخرین بروزرسانی: ${updatedAt}.`);

  return lines.join("\n");
}

export function buildAdminServerDetailMessage(server, connectionResult, updatedAt) {
  const connText =
    connectionResult?.success
      ? "متصل"
      : connectionResult?.error
        ? `قطع — ${connectionResult.error}`
        : "قطع";

  return [
    `${adminEmoji(AdminEmoji.DETAIL)} <b>جزئیات سرور</b>`,
    "",
    `${adminEmoji(AdminEmoji.SERVERS)} <b>${server.serverName}</b> — PasarGuard`,
    "",
    `${adminEmoji(AdminEmoji.CONNECTION)} <b>وضعیت اتصال:</b> ${connText}`,
    `${adminEmoji(AdminEmoji.ACTIVE)} <b>فعال:</b> ${server.isActive ? "بله" : "خیر"}`,
    `${adminEmoji(AdminEmoji.SALES)} <b>فروش:</b> ${server.salesEnabled ? "باز" : "بسته"}`,
    `${adminEmoji(AdminEmoji.RENEWAL)} <b>تمدید:</b> ${server.renewalEnabled ? "فعال" : "غیرفعال"}`,
    "",
    `${adminEmoji(AdminEmoji.SETTINGS)} <b>سرویس‌های اوتباند</b>`,
    `${adminEmoji(AdminEmoji.DESC)} <b>حجمی:</b> ${featureStatusText(isServerOutboundVolumeEnabled(server))}`,
    `${adminEmoji(AdminEmoji.DESC)} <b>به ازای مصرف:</b> ${featureStatusText(isServerOutboundUsageEnabled(server))}`,
    "",
    `${adminEmoji(AdminEmoji.PANEL)} <b>سرویس‌های پنل</b>`,
    `${adminEmoji(AdminEmoji.DESC)} <b>حجمی:</b> ${featureStatusText(isServerPanelVolumeEnabled(server))}`,
    `${adminEmoji(AdminEmoji.DESC)} <b>به ازای مصرف:</b> ${featureStatusText(isServerPanelUsageEnabled(server))}`,
    `${adminEmoji(AdminEmoji.DESC)} <b>نامحدود:</b> ${featureStatusText(isServerPanelUnlimitedEnabled(server))}`,
    "",
    `${adminEmoji(AdminEmoji.REFRESH)} آخرین بروزرسانی: ${updatedAt}.`,
  ].join("\n");
}

export function buildAdminServerDeleteConfirmMessage(serverName) {
  return [
    `${adminEmoji(AdminEmoji.DELETE)} <b>حذف سرور</b>`,
    "",
    `آیا از حذف سرور <b>${serverName}</b> مطمئن هستید؟`,
    "",
    "این عملیات قابل بازگشت نیست.",
  ].join("\n");
}

export function buildAdminServerAddPromptMessage(stepLabel) {
  return [
    `${adminEmoji(AdminEmoji.ADD)} <b>افزودن سرور PasarGuard</b>`,
    "",
    `لطفاً <b>${stepLabel}</b> را وارد کنید:`,
  ].join("\n");
}

export function buildAdminServerConnectingMessage(serverName) {
  return [
    `${adminEmoji(AdminEmoji.CONNECTION)} <b>تست اتصال به پنل</b>`,
    "",
    `در حال بررسی اتصال به سرور <b>${serverName}</b>...`,
    "",
    "لطفاً چند لحظه صبر کنید.",
  ].join("\n");
}

export function buildAdminServerAddSuccessMessage(serverName) {
  return [
    `${adminEmoji(AdminEmoji.CONFIRM)} <b>اتصال موفق</b>`,
    "",
    `سرور <b>${serverName}</b> با موفقیت به پنل PasarGuard متصل و در سیستم ثبت شد.`,
  ].join("\n");
}

export function buildAdminServerAddFailedMessage(serverName, error) {
  return [
    `${adminEmoji(AdminEmoji.DELETE)} <b>اتصال ناموفق</b>`,
    "",
    `سرور <b>${serverName}</b> ذخیره نشد.`,
    "",
    `<b>علت:</b> ${error}`,
    "",
    "اطلاعات را بررسی کنید و دوباره «افزودن سرور» را امتحان کنید.",
  ].join("\n");
}

export function buildAdminServerEditPromptMessage(fieldLabel, currentValue) {
  const escaped = String(currentValue || "(خالی)")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return [
    `${adminEmoji(AdminEmoji.EDIT)} <b>ویرایش ${fieldLabel}</b>`,
    "",
    `مقدار فعلی: <code>${escaped}</code>`,
    "",
    "مقدار جدید را وارد کنید:",
  ].join("\n");
}
