import { adminEmoji, AdminEmoji } from "../constants/emojis.js";
import { formatJalaliDateTime } from "../lib/tehran-time.js";
import { formatToman } from "./wallet.message.js";

export function buildAdminPricingSettingsMessage({
  panelUsagePricePerGb,
  outboundPricePerGb,
  panelUnlimitedPricePerSub,
  panelUnlimitedPricePerUser,
  updatedAt,
}) {
  return [
    `${adminEmoji(AdminEmoji.SETTINGS)} <b>قیمت‌گذاری اشتراک‌ها</b>`,
    "",
    `${adminEmoji(AdminEmoji.DESC)} قیمت‌های زیر در تمام بخش‌های ربات و صفحه سوالات متداول اعمال می‌شوند.`,
    "",
    `${adminEmoji(AdminEmoji.TRAFFIC)} <b>پنل مصرفی (هر گیگ):</b> ${formatToman(panelUsagePricePerGb)} تومان`,
    `${adminEmoji(AdminEmoji.TRAFFIC)} <b>اوتباند حجمی/مصرفی (هر گیگ):</b> ${formatToman(outboundPricePerGb)} تومان`,
    `${adminEmoji(AdminEmoji.SALES)} <b>نامحدود (هر اشتراک):</b> ${formatToman(panelUnlimitedPricePerSub)} تومان`,
    `${adminEmoji(AdminEmoji.SALES)} <b>نامحدود (هر کاربر):</b> ${formatToman(panelUnlimitedPricePerUser)} تومان`,
    "",
    `${adminEmoji(AdminEmoji.TIME)} آخرین بروزرسانی: ${formatJalaliDateTime(updatedAt)}`,
  ].join("\n");
}

export const adminSetPanelUsagePricePromptMessage = [
  `${adminEmoji(AdminEmoji.SETTINGS)} <b>قیمت پنل مصرفی</b>`,
  "",
  "قیمت هر گیگابایت ترافیک مصرفی پنل را به <b>تومان</b> وارد کنید.",
].join("\n");

export const adminSetOutboundPricePromptMessage = [
  `${adminEmoji(AdminEmoji.SETTINGS)} <b>قیمت اوتباند</b>`,
  "",
  "قیمت هر گیگابایت اوتباند (حجمی و مصرفی) را به <b>تومان</b> وارد کنید.",
].join("\n");

export const adminSetUnlimitedSubPricePromptMessage = [
  `${adminEmoji(AdminEmoji.SETTINGS)} <b>قیمت اشتراک نامحدود</b>`,
  "",
  "قیمت هر اشتراک سرویس نامحدود پنل را به <b>تومان</b> وارد کنید.",
].join("\n");

export const adminSetUnlimitedUserPricePromptMessage = [
  `${adminEmoji(AdminEmoji.SETTINGS)} <b>قیمت کاربر نامحدود</b>`,
  "",
  "قیمت هر کاربر اضافه در سرویس نامحدود را به <b>تومان</b> وارد کنید.",
].join("\n");
