import { PremiumEmoji, premiumEmoji } from "../constants/emojis.js";

export const newServiceOutboundMessage = [
  `${premiumEmoji(PremiumEmoji.OUTBOUND_PAYMENT_TITLE)} <b>انتخاب روش پرداخت</b>`,
  "",
  "لطفاً یکی از <b>روش‌های زیر</b> را برای استفاده از سرویس انتخاب کنید:",
  "",
  `${premiumEmoji(PremiumEmoji.VOLUME_PACKAGE)} <b>خرید پکیج حجمی</b>`,
  "در این روش، <b>حجم موردنیاز</b> خود را انتخاب کرده و هزینه آن را به‌صورت <b>یکجا</b> پرداخت می‌کنید. پس از اتمام یا نزدیک شدن به پایان حجم خریداری‌شده، می‌توانید سرویس خود را <b>مجدداً تمدید یا شارژ</b> نمایید.",
  "",
  `${premiumEmoji(PremiumEmoji.TOPUP_CONFIRM)} <b>پرداخت به ازای مصرف</b>`,
  "در این روش نیازی به خرید <b>پکیج حجمی</b> ندارید. کافی است کاربر خود را ایجاد کنید و هزینه مصرف به‌صورت خودکار بر اساس <b>میزان ترافیک استفاده‌شده</b> از کیف پول شما کسر خواهد شد. برای استفاده از این روش، <b>حداقل موجودی کیف پول</b> شما باید معادل <b>۵۰ گیگابایت</b> ترافیک باشد.",
  "",
  `${premiumEmoji(PremiumEmoji.TOPUP_METHOD_CHOOSE)} <b>روش موردنظر</b> خود را انتخاب کنید:`,
].join("\n");
