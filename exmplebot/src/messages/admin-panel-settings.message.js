import { MIN_PANEL_UNLIMITED_COUNT } from "../constants/panel-unlimited.js";
import { adminEmoji, AdminEmoji } from "../constants/emojis.js";
import { formatJalaliDateTime } from "../lib/tehran-time.js";

export function buildAdminPanelSettingsMessage({
  capacity,
  sold,
  remaining,
  updatedAt,
}) {
  return [
    `${adminEmoji(AdminEmoji.SETTINGS)} <b>تنظیمات پنل</b>`,
    "",
    `${adminEmoji(AdminEmoji.DESC)} <b>ظرفیت سرویس نامحدود</b>`,
    `${adminEmoji(AdminEmoji.TRAFFIC)} ظرفیت کل: <b>${Number(capacity).toLocaleString("en-US")}</b> عدد`,
    `${adminEmoji(AdminEmoji.SALES)} فروخته‌شده: <b>${Number(sold).toLocaleString("en-US")}</b> عدد`,
    `${adminEmoji(AdminEmoji.STATUS)} باقی‌مانده: <b>${Number(remaining).toLocaleString("en-US")}</b> عدد`,
    "",
    `${adminEmoji(AdminEmoji.DESC)} حداقل قابل خرید برای کاربر: <b>${MIN_PANEL_UNLIMITED_COUNT}</b> عدد`,
    `${adminEmoji(AdminEmoji.TIME)} آخرین بروزرسانی: ${formatJalaliDateTime(updatedAt)}`,
  ].join("\n");
}

export const adminSetPanelUnlimitedCapacityPromptMessage = [
  `${adminEmoji(AdminEmoji.SETTINGS)} <b>ظرفیت سرویس نامحدود</b>`,
  "",
  "تعداد کل اکانت‌های نامحدود قابل فروش را وارد کنید.",
  "این عدد نباید از تعداد <b>فروخته‌شده</b> کمتر باشد.",
].join("\n");
