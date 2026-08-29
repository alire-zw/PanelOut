import {
  PANEL_USAGE_MIN_BALANCE_GB,
} from "../constants/service-types.js";
import { PremiumEmoji, premiumEmoji } from "../constants/emojis.js";
import { formatOutboundVolumeText } from "../lib/outbound-volume-steps.js";
import { formatToman } from "./wallet.message.js";
import { SubscriptionPanelStatus } from "../constants/service-types.js";

export function buildPanelUsageActivationMessage({
  balance,
  minBalanceIrt,
  minBalanceGb,
  hasTrial = false,
  trialUsername = null,
}) {
  const lines = [
    `${premiumEmoji(PremiumEmoji.SERVICE_PANEL_BTN)} <b>سرویس پنل به‌ازای مصرف</b>`,
    "",
    `${premiumEmoji(PremiumEmoji.OUTBOUND_USAGE_ACTIVATE)} در این روش یک <b>اکانت ادمین نامحدود</b> روی پنل در اختیار شما قرار می‌گیرد. مصرف کاربرانی که در پنل خود می‌سازید به‌صورت <b>لحظه‌ای</b> از <b>موجودی کیف پول</b> کسر می‌شود.`,
    "",
    `${premiumEmoji(PremiumEmoji.OUTBOUND_USAGE_SUSPEND)} در صورت <b>اتمام موجودی</b>، تمام کاربران فعال شما در پنل به‌صورت خودکار <b>غیرفعال</b> می‌شوند و پس از <b>شارژ مجدد کیف پول</b> دوباره فعال خواهند شد.`,
    "",
    `${premiumEmoji(PremiumEmoji.WALLET)} <b>موجودی کیف پول:</b> ${formatToman(balance)} تومان`,
    `${premiumEmoji(PremiumEmoji.DEPOSIT_IRT)} <b>حداقل موجودی لازم:</b> معادل ${formatOutboundVolumeText(minBalanceGb)} (${formatToman(minBalanceIrt)} تومان)`,
  ];

  if (hasTrial && trialUsername) {
    lines.push(
      "",
      `${premiumEmoji(PremiumEmoji.PANEL_TRIAL_BTN)} شما اکانت تست با یوزرنیم <b>${trialUsername}</b> دارید. با تأیید، همان اکانت به سرویس مصرفی ارتقا می‌یابد.`,
    );
  } else {
    lines.push(
      "",
      `${premiumEmoji(PremiumEmoji.RIAL_NOTIFY)} پس از تأیید، <b>یوزرنیم</b> اکانت ادمین را وارد کنید:`,
    );
  }

  return lines.join("\n");
}

export function buildPanelUsageActiveServiceMessage({ panelStatus }) {
  const statusNote =
    panelStatus === SubscriptionPanelStatus.SUSPENDED
      ? "سرویس در حالت <b>تعلیق</b> است و کاربران پنل غیرفعال شده‌اند."
      : "سرویس شما <b>فعال</b> است.";

  return [
    `${premiumEmoji(PremiumEmoji.SERVICE_PANEL_BTN)} <b>اکانت ادمین فعال</b>`,
    "",
    statusNote,
    "",
    `${premiumEmoji(PremiumEmoji.INVALID_THINKING)} رمز عبور در حساب شما ذخیره شده است. برای کپی، روی دکمه‌های زیر بزنید.`,
  ].join("\n");
}

export function buildPanelUsageInsufficientBalanceMessage({
  balance,
  minBalanceIrt,
  minBalanceGb,
}) {
  const need = BigInt(minBalanceIrt) - BigInt(balance);

  return [
    `${premiumEmoji(PremiumEmoji.TOPUP_DESC)} <b>موجودی کیف پول کافی نیست</b>`,
    "",
    `${premiumEmoji(PremiumEmoji.WALLET_BALANCE)} موجودی شما: <b>${formatToman(balance)}</b> تومان`,
    `${premiumEmoji(PremiumEmoji.DEPOSIT_IRT)} حداقل لازم: <b>${formatToman(minBalanceIrt)}</b> تومان (معادل ${formatOutboundVolumeText(minBalanceGb)})`,
    "",
    `${premiumEmoji(PremiumEmoji.WALLET_TOP_UP)} برای فعال‌سازی به <b>${formatToman(need)}</b> تومان دیگر نیاز دارید. ابتدا کیف پول خود را شارژ کنید.`,
  ].join("\n");
}

export const panelUsageUsernamePromptMessage = [
  `${premiumEmoji(PremiumEmoji.SERVICE_PANEL_BTN)} <b>فعال‌سازی اکانت ادمین</b>`,
  "",
  "برای ساخت <b>اکانت ادمین نامحدود</b> روی پنل، یک <b>یوزرنیم</b> انتخاب کنید.",
  "",
  `${premiumEmoji(PremiumEmoji.INVALID_THINKING)} یوزرنیم فقط با <b>حروف کوچک انگلیسی</b> (a-z) و بدون فاصله باشد.`,
  "",
  `${premiumEmoji(PremiumEmoji.OCTOPUS)} یوزرنیم موردنظر را در پیام بعدی ارسال کنید:`,
].join("\n");

export function buildPanelUsageUsernamePromptMessage() {
  return panelUsageUsernamePromptMessage;
}

export function buildPanelUsageUsernameTakenMessage() {
  return [
    `${premiumEmoji(PremiumEmoji.INVALID_CONFUSED)} <b>این یوزرنیم قبلاً انتخاب شده است</b>`,
    "",
    "لطفاً یک <b>یوزرنیم دیگر</b> وارد کنید.",
    "",
    `${premiumEmoji(PremiumEmoji.INVALID_THINKING)} یوزرنیم فقط با <b>حروف کوچک انگلیسی</b> (a-z) و بدون فاصله باشد.`,
  ].join("\n");
}

export function buildPanelUsageUpgradedFromTrialMessage() {
  return [
    `${premiumEmoji(PremiumEmoji.SERVICE_PANEL_BTN)} <b>اکانت تست به سرویس مصرفی ارتقا یافت</b>`,
    "",
    `${premiumEmoji(PremiumEmoji.INVALID_THINKING)} همان <b>یوزرنیم و رمز عبور</b> اکانت تست شما فعال است و محدودیت حجم تست برداشته شد.`,
    `${premiumEmoji(PremiumEmoji.INVALID_THINKING)} مصرف کاربران پنل از این پس به‌صورت خودکار از کیف پول کسر می‌شود.`,
  ].join("\n");
}

export function buildPanelUsageInvalidUsernameMessage() {
  return [
    panelUsageUsernamePromptMessage,
    "",
    `${premiumEmoji(PremiumEmoji.INVALID_CONFUSED)} یوزرنیم واردشده نامعتبر است. فقط حروف کوچک انگلیسی (a-z) مجاز است.`,
  ].join("\n");
}

export const panelUsageProcessingMessage = [
  `${premiumEmoji(PremiumEmoji.SERVICE_PANEL_BTN)} <b>در حال ساخت اکانت ادمین...</b>`,
  "",
  "لطفاً چند لحظه صبر کنید.",
].join("\n");

export function buildPanelUsageSuccessMessage() {
  return [
    `${premiumEmoji(PremiumEmoji.SERVICE_PANEL_BTN)} <b>اکانت ادمین ساخته شد</b>`,
    "",
    `${premiumEmoji(PremiumEmoji.INVALID_THINKING)} مصرف کاربران پنل شما به‌صورت خودکار از کیف پول کسر می‌شود.`,
    `${premiumEmoji(PremiumEmoji.INVALID_THINKING)} اطلاعات ورود را از دکمه‌های زیر کپی کنید یا مستقیم وارد پنل شوید.`,
  ].join("\n");
}

export const panelUsageUnavailableMessage = [
  `${premiumEmoji(PremiumEmoji.INVALID_CONFUSED)} <b>سرویس در دسترس نیست</b>`,
  "",
  "در حال حاضر امکان ساخت اکانت ادمین به‌ازای مصرف وجود ندارد. لطفاً بعداً دوباره تلاش کنید.",
].join("\n");

export function buildPanelUsageFailedMessage(error, { isAdmin = false } = {}) {
  const code = error?.code || "UNKNOWN";
  const message = error?.message || "خطای ناشناخته";

  if (code === "USERNAME_TAKEN") {
    return buildPanelUsageUsernameTakenMessage();
  }

  if (
    code === "PROVISION_FAILED" &&
    /fetch failed|network|timed out|timeout|econnreset|enotfound/i.test(message)
  ) {
    return [
      `${premiumEmoji(PremiumEmoji.INVALID_CONFUSED)} <b>خطا در ارتباط با پنل</b>`,
      "ارتباط با سرور پنل برقرار نشد. اگر اکانت شما ساخته شده، دوباره همان یوزرنیم را ارسال کنید.",
      "در غیر این صورت چند لحظه صبر کنید و دوباره تلاش کنید.",
      ...(isAdmin ? ["", "<b>لاگ خطا:</b>", message] : []),
    ].join("\n");
  }

  if (code === "ROLE_NOT_FOUND") {
    return [
      `${premiumEmoji(PremiumEmoji.INVALID_CONFUSED)} <b>نقش operator پیدا نشد</b>`,
      "نقش <b>operator</b> روی پنل PasarGuard پیدا نشد.",
      ...(isAdmin ? ["", "<b>لاگ خطا:</b>", message] : []),
    ].join("\n");
  }

  return [
    `${premiumEmoji(PremiumEmoji.INVALID_CONFUSED)} <b>خطا در ساخت اکانت</b>`,
    "متأسفانه ساخت اکانت ادمین ناموفق بود. لطفاً دوباره تلاش کنید.",
    ...(isAdmin ? ["", "<b>لاگ خطا:</b>", `${code} — ${message}`] : []),
  ].join("\n");
}
