import { formatOutboundVolumeText } from "../lib/outbound-volume-steps.js";
import { PremiumEmoji, premiumEmoji } from "../constants/emojis.js";
import { formatToman } from "./wallet.message.js";

export function buildNewServiceOutboundVolumeMessage({
  pricePerGb = 0,
  selectedGb = 0,
  discountPercent = 0,
  totalPrice = 0,
} = {}) {
  const lines = [
    `${premiumEmoji(PremiumEmoji.NEW_SERVICE)} <b>خرید پکیج حجمی</b>`,
    "",
    "حجم موردنظر خود را از طریق <b>دکمه‌های زیر</b> انتخاب کنید. هزینه سرویس بر اساس <b>حجم انتخابی</b> شما محاسبه شده و پس از پرداخت، ترافیک خریداری‌شده به حساب شما اضافه خواهد شد.",
    "",
    `${premiumEmoji(PremiumEmoji.WALLET)} <b>قیمت هر گیگابایت:</b> ${formatToman(pricePerGb)} تومان`,
    `${premiumEmoji(PremiumEmoji.STATS_DESC)} <b>حجم انتخاب‌شده:</b> ${formatOutboundVolumeText(selectedGb)}`,
  ];

  if (discountPercent > 0) {
    lines.push(
      `${premiumEmoji(PremiumEmoji.TOPUP_METHOD_TITLE)} <b>تخفیف:</b> ${discountPercent}٪`,
    );
  }

  lines.push(
    `${premiumEmoji(PremiumEmoji.DEPOSIT_IRT)} <b>مبلغ قابل پرداخت:</b> ${formatToman(totalPrice)} تومان`,
    "",
    `${premiumEmoji(PremiumEmoji.OCTOPUS)} پس از بررسی <b>حجم انتخابی</b> و <b>مبلغ نهایی</b>، برای تکمیل سفارش و پرداخت هزینه روی دکمه «<b>تایید و ادامه خرید</b>» کلیک کنید:`,
  );

  return lines.join("\n");
}
