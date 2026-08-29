import { PremiumEmoji, premiumEmoji } from "../constants/emojis.js";
import { formatPanelUnlimitedCountText } from "../lib/panel-unlimited-steps.js";
import { formatPanelUnlimitedDaysText } from "../lib/panel-unlimited-days-steps.js";
import { formatPanelUnlimitedMaxUsersText } from "../lib/panel-unlimited-users-steps.js";
export const panelUnlimitedUsernamePromptMessage = [
  `${premiumEmoji(PremiumEmoji.SERVICE_PANEL_BTN)} <b>تکمیل خرید سرویس نامحدود</b>`,
  "",
  "برای ساخت <b>اکانت ادمین پنل</b>، یک <b>یوزرنیم</b> انتخاب کنید.",
  "",
  `${premiumEmoji(PremiumEmoji.INVALID_THINKING)} یوزرنیم فقط با <b>حروف کوچک انگلیسی</b> (a-z) و بدون فاصله باشد.`,
  "",
  `${premiumEmoji(PremiumEmoji.OCTOPUS)} یوزرنیم موردنظر را در پیام بعدی ارسال کنید:`,
].join("\n");

export function buildPanelUnlimitedUsernamePromptMessage({
  count,
  maxUsers,
  days,
}) {
  return [
    panelUnlimitedUsernamePromptMessage,
    "",
    `${premiumEmoji(PremiumEmoji.STATS_DESC)} <b>تعداد اشتراک:</b> ${formatPanelUnlimitedCountText(count)}`,
    `${premiumEmoji(PremiumEmoji.STATS_DESC)} <b>سقف کاربر هر اشتراک:</b> ${formatPanelUnlimitedMaxUsersText(maxUsers)}`,
    `${premiumEmoji(PremiumEmoji.STATS_DESC)} <b>مدت اشتراک:</b> ${formatPanelUnlimitedDaysText(days)}`,
  ].join("\n");
}

export const panelUnlimitedProcessingMessage = [
  `${premiumEmoji(PremiumEmoji.SERVICE_PANEL_BTN)} <b>در حال ساخت اکانت...</b>`,
  "",
  "لطفاً چند لحظه صبر کنید.",
].join("\n");

export function buildPanelUnlimitedSuccessMessage({ isUpgrade = false } = {}) {
  const lines = [
    `${premiumEmoji(PremiumEmoji.SERVICE_PANEL_BTN)} <b>${isUpgrade ? "خرید با موفقیت ثبت شد" : "اکانت ادمین ساخته شد"}</b>`,
    "",
    `${premiumEmoji(PremiumEmoji.INVALID_THINKING)} اطلاعات ورود را از دکمه‌های زیر کپی کنید یا مستقیم وارد پنل شوید.`,
  ];

  if (isUpgrade) {
    lines.push(
      "",
      `${premiumEmoji(PremiumEmoji.OCTOPUS)} محدودیت‌های اکانت ادمین شما با این خرید به‌روزرسانی شد.`,
    );
  }

  return lines.join("\n");
}

export function buildPanelUnlimitedUnavailableMessage({ reason, serverId, isAdmin = false } = {}) {
  const lines = [
    `${premiumEmoji(PremiumEmoji.INVALID_CONFUSED)} <b>سرویس در دسترس نیست</b>`,
    "",
    "در حال حاضر امکان ساخت اکانت نامحدود وجود ندارد. لطفاً بعداً دوباره تلاش کنید.",
  ];

  if (isAdmin && reason) {
    lines.push(
      "",
      "<b>لاگ خطا:</b>",
      `سرور: ${serverId ?? "—"} — ${reason}`,
    );
  }

  return lines.join("\n");
}

export const panelUnlimitedUnavailableMessage = buildPanelUnlimitedUnavailableMessage();

export function buildPanelUnlimitedInvalidUsernameMessage({ count, maxUsers, days } = {}) {
  return [
    buildPanelUnlimitedUsernamePromptMessage({ count, maxUsers, days }),
    "",
    `${premiumEmoji(PremiumEmoji.INVALID_CONFUSED)} یوزرنیم واردشده نامعتبر است. فقط حروف کوچک انگلیسی (a-z) مجاز است.`,
  ].join("\n");
}

function formatPanelUnlimitedErrorLog({ code, status, message }) {
  const parts = [];

  if (code) parts.push(`کد: ${code}`);
  if (status) parts.push(`HTTP: ${status}`);
  if (message) parts.push(message);

  return parts.join(" — ");
}

export function buildPanelUnlimitedFailedMessage(error, { isAdmin = false } = {}) {
  const code = error?.code || "UNKNOWN";
  const status = error?.status ?? null;
  const message = error?.message || "خطای ناشناخته";

  if (code === "USERNAME_TAKEN") {
    return [
      panelUnlimitedUsernamePromptMessage,
      "",
      `${premiumEmoji(PremiumEmoji.INVALID_CONFUSED)} این یوزرنیم قبلاً ثبت شده است. یوزرنیم دیگری انتخاب کنید.`,
    ].join("\n");
  }

  if (code === "ROLE_NOT_FOUND") {
    return [
      `${premiumEmoji(PremiumEmoji.INVALID_CONFUSED)} <b>نقش operator پیدا نشد</b>`,
      "نقش <b>operator</b> روی پنل PasarGuard پیدا نشد. لطفاً با پشتیبانی تماس بگیرید.",
      ...(isAdmin
        ? ["", "<b>لاگ خطا:</b>", formatPanelUnlimitedErrorLog({ code, status, message })]
        : []),
    ].join("\n");
  }

  return [
    `${premiumEmoji(PremiumEmoji.INVALID_CONFUSED)} <b>خطا در ساخت اکانت</b>`,
    "متأسفانه ساخت اکانت ادمین ناموفق بود. لطفاً دوباره تلاش کنید.",
    ...(isAdmin
      ? ["", "<b>لاگ خطا:</b>", formatPanelUnlimitedErrorLog({ code, status, message })]
      : []),
  ].join("\n");
}
