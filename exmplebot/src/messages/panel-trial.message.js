import { PremiumEmoji, premiumEmoji } from "../constants/emojis.js";

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export const panelTrialUsernamePromptMessage = [
  `${premiumEmoji(PremiumEmoji.PANEL_TRIAL_BTN)} <b>ساخت اکانت و تست سرویس</b>`,
  "",
  "لطفاً یک <b>یوزرنیم</b> برای اکانت تست خود وارد کنید.",
  "",
  "فقط <b>حروف کوچک انگلیسی</b> (a تا z) مجاز است.",
  "از <b>حروف بزرگ</b>، <b>اعداد</b> و <b>علامت</b> استفاده نکنید.",
].join("\n");

export const panelTrialProcessingMessage = [
  `${premiumEmoji(PremiumEmoji.SUBSCRIPTION_BUILDING)} <b>در حال ساخت اکانت شما هستیم، لطفاً صبر کنید...</b>`,
].join("\n");

export function buildPanelTrialSuccessMessage() {
  return [
    `${premiumEmoji(PremiumEmoji.SERVICE_CELEBRATE)} <b>اکانت تست شما با موفقیت ساخته شد.</b>`,
    "",
    `${premiumEmoji(PremiumEmoji.SUBSCRIPTION_ADDRESS_TIP)} با اطلاعات زیر به‌عنوان <b>اپراتور</b> وارد <b>پنل</b> شوید و سرویس خود را تست کنید.`,
    `${premiumEmoji(PremiumEmoji.INVALID_THINKING)} برای کپی یوزرنیم و رمز، روی دکمه‌های زیر بزنید.`,
  ].join("\n");
}

export const panelTrialAlreadyClaimedMessage = [
  `${premiumEmoji(PremiumEmoji.PANEL_TRIAL_BTN)} <b>اشتراک تست</b>`,
  "",
  "شما قبلاً یک <b>اکانت تست</b> دریافت کرده‌اید.",
  "برای ادامه از <b>سرویس پنل</b> یا <b>پشتیبانی</b> استفاده کنید.",
].join("\n");

export const panelTrialUnavailableMessage = [
  `${premiumEmoji(PremiumEmoji.INVALID_CONFUSED)} <b>سرویس تست در دسترس نیست</b>`,
  "",
  "در حال حاضر سرور مناسبی برای <b>ساخت اکانت تست</b> فعال نیست.",
  "لطفاً بعداً دوباره تلاش کنید یا با <b>پشتیبانی</b> تماس بگیرید.",
].join("\n");

export function buildPanelTrialInvalidUsernameMessage() {
  return [
    "⚠️ <b>یوزرنیم نامعتبر است.</b>",
    "",
    "فقط <b>حروف کوچک انگلیسی</b> (a تا z) وارد کنید.",
    "از <b>حروف بزرگ</b>، <b>اعداد</b> و <b>علامت</b> استفاده نکنید.",
    "",
    panelTrialUsernamePromptMessage,
  ].join("\n");
}

function formatPanelTrialErrorLog({ code, status, message }) {
  const lines = [
    `<code>code: ${escapeHtml(code || "unknown")}</code>`,
  ];

  if (status != null) {
    lines.push(`<code>status: ${escapeHtml(status)}</code>`);
  }

  lines.push(`<code>${escapeHtml(message || "unknown error")}</code>`);
  return lines.join("\n");
}

export function buildPanelTrialFailedMessage(error, { isAdmin = false } = {}) {
  const code = typeof error === "string" ? error : error?.code;
  const status = typeof error === "object" ? error?.status : null;
  const message = typeof error === "object" ? error?.message : error;

  if (code === "USERNAME_TAKEN") {
    return [
      "⚠️ <b>این یوزرنیم قبلاً انتخاب شده است.</b>",
      "",
      "لطفاً یک <b>یوزرنیم دیگر</b> وارد کنید.",
      "",
      "یوزرنیم فقط با <b>حروف کوچک انگلیسی</b> (a-z) مجاز است.",
      ...(isAdmin
        ? ["", "<b>لاگ خطا:</b>", formatPanelTrialErrorLog({ code, status, message })]
        : []),
    ].join("\n");
  }

  if (code === "TELEGRAM_ID_TAKEN") {
    return [
      `${premiumEmoji(PremiumEmoji.INVALID_CONFUSED)} <b>ساخت اکانت ناموفق بود</b>`,
      "",
      "این <b>اکانت تلگرام</b> قبلاً روی پنل ثبت شده است.",
      "اگر اکانت تست دارید با <b>پشتیبانی</b> تماس بگیرید.",
      ...(isAdmin
        ? ["", "<b>لاگ خطا:</b>", formatPanelTrialErrorLog({ code, status, message })]
        : []),
    ].join("\n");
  }

  if (code === "ROLE_NOT_FOUND") {
    return [
      `${premiumEmoji(PremiumEmoji.INVALID_CONFUSED)} <b>ساخت اکانت ناموفق بود</b>`,
      "",
      "نقش <b>operator</b> روی <b>پنل PasarGuard</b> پیدا نشد.",
      ...(isAdmin
        ? ["", "<b>لاگ خطا:</b>", formatPanelTrialErrorLog({ code, status, message })]
        : []),
    ].join("\n");
  }

  return [
    `${premiumEmoji(PremiumEmoji.INVALID_CONFUSED)} <b>ساخت اکانت ناموفق بود</b>`,
    "",
    "لطفاً چند لحظه بعد دوباره تلاش کنید.",
    "اگر مشکل ادامه داشت با <b>پشتیبانی</b> در ارتباط باشید.",
    ...(isAdmin
      ? ["", "<b>لاگ خطا:</b>", formatPanelTrialErrorLog({ code, status, message })]
      : []),
  ].join("\n");
}
