import { PremiumEmoji, premiumEmoji } from "../constants/emojis.js";

export function buildNewServicePanelMessage({ showTrial = true } = {}) {
  const lines = [
    `${premiumEmoji(PremiumEmoji.SERVICE_PANEL_BTN)} <b>انتخاب روش پرداخت</b>`,
    "",
    "لطفاً یکی از <b>روش‌های زیر</b> را برای استفاده از <b>سرویس پنل</b> انتخاب کنید:",
    "",
  ];

  if (showTrial) {
    lines.push(
      `${premiumEmoji(PremiumEmoji.PANEL_TRIAL_BTN)} <b>ساخت اکانت و تست سرویس</b>`,
      "با این روش می‌توانید یک <b>اکانت تست</b> بسازید و قبل از خرید، <b>سرویس پنل</b> را امتحان کنید.",
      "",
    );
  }

  lines.push(
    `${premiumEmoji(PremiumEmoji.VOLUME_PACKAGE)} <b>سرویس نامحدود</b>`,
    "این سرویس به‌صورت <b>تعدادی</b> و با <b>ظرفیت محدود</b> ارائه می‌شود. همیشه در دسترس نیست؛ گاهی با <b>اعلام موجودی</b> در ربات یا کانال، امکان خرید آن فراهم می‌شود.",
    "",
    `${premiumEmoji(PremiumEmoji.TOPUP_CONFIRM)} <b>پرداخت به ازای مصرف</b>`,
    "در این روش نیازی به خرید <b>سرویس نامحدود</b> ندارید. کافی است کاربران خود را در پنل ایجاد کنید و هزینه مصرف به‌صورت خودکار بر اساس <b>میزان ترافیک استفاده‌شده</b> از کیف پول شما کسر خواهد شد. برای استفاده از این روش، <b>حداقل موجودی کیف پول</b> شما باید معادل <b>۵۰ گیگابایت</b> ترافیک باشد.",
    "",
    `${premiumEmoji(PremiumEmoji.TOPUP_METHOD_CHOOSE)} <b>روش موردنظر</b> خود را انتخاب کنید:`,
  );

  return lines.join("\n");
}

export const newServicePanelMessage = buildNewServicePanelMessage();
