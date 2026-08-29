import { formatOutboundVolumeText } from "../lib/outbound-volume-steps.js";
import { PremiumEmoji, premiumEmoji } from "../constants/emojis.js";
import {
  formatCardNumber,
  formatShebaNumber,
} from "../services/payment-settings.service.js";
import { formatToman } from "./wallet.message.js";

export function buildOutboundVolumePaymentMessage({
  volumeGb,
  amountIrt,
  pricePerGb,
  discountPercent,
  balance,
  cardEnabled,
}) {
  const intro = cardEnabled
    ? "انتخاب شما <b>سرویس اوتباند (پکیج حجمی)</b> است. پس از بررسی <b>جزئیات سفارش</b> و <b>مبلغ نهایی</b>، برای تکمیل خرید می‌توانید هزینه را از طریق <b>کیف پول</b> یا <b>کارت به کارت</b> پرداخت کنید."
    : "انتخاب شما <b>سرویس اوتباند (پکیج حجمی)</b> است. پس از بررسی <b>جزئیات سفارش</b> و <b>مبلغ نهایی</b>، برای تکمیل خرید می‌توانید هزینه را از طریق <b>کیف پول</b> پرداخت کنید.";

  const lines = [
    `${premiumEmoji(PremiumEmoji.WALLET_TOP_UP)} <b>مرحله پرداخت</b>`,
    "",
    intro,
    "",
    `${premiumEmoji(PremiumEmoji.WALLET)} <b>قیمت هر گیگابایت:</b> ${formatToman(pricePerGb)} تومان`,
    `${premiumEmoji(PremiumEmoji.STATS_DESC)} <b>حجم انتخاب‌شده:</b> ${formatOutboundVolumeText(volumeGb)}`,
  ];

  if (discountPercent > 0) {
    lines.push(
      `${premiumEmoji(PremiumEmoji.TOPUP_METHOD_TITLE)} <b>تخفیف:</b> ${discountPercent}٪`,
    );
  }

  lines.push(
    `${premiumEmoji(PremiumEmoji.DEPOSIT_IRT)} <b>مبلغ قابل پرداخت:</b> ${formatToman(amountIrt)} تومان`,
    `${premiumEmoji(PremiumEmoji.WALLET_BALANCE)} <b>موجودی کیف پول:</b> ${formatToman(balance)} تومان`,
    "",
    `${premiumEmoji(PremiumEmoji.DEPOSIT_SUCCESS)} لطفاً <b>روش پرداخت</b> موردنظر خود را انتخاب کنید:`,
  );

  return lines.join("\n");
}

export function buildOutboundVolumeInsufficientBalanceMessage({
  balance,
  amountIrt,
}) {
  const need = BigInt(amountIrt) - BigInt(balance);

  return [
    `${premiumEmoji(PremiumEmoji.TOPUP_DESC)} <b>موجودی کیف پول کافی نیست</b>`,
    "",
    `${premiumEmoji(PremiumEmoji.WALLET_BALANCE)} موجودی شما: <b>${formatToman(balance)}</b> تومان`,
    `${premiumEmoji(PremiumEmoji.DEPOSIT_IRT)} مبلغ این خرید: <b>${formatToman(amountIrt)}</b> تومان`,
    "",
    `${premiumEmoji(PremiumEmoji.WALLET_TOP_UP)} برای تکمیل خرید به <b>${formatToman(need)}</b> تومان دیگر نیاز دارید. ابتدا کیف پول خود را شارژ کنید.`,
  ].join("\n");
}

export function buildOutboundVolumeWalletProcessingMessage() {
  return `${premiumEmoji(PremiumEmoji.SUBSCRIPTION_BUILDING)} در حال <b>ساخت اشتراک</b> شما هستیم. لطفاً <b>صبر کنید</b>.`;
}

export function buildOutboundVolumeProvisionFailedMessage() {
  return [
    `${premiumEmoji(PremiumEmoji.TOPUP_DESC)} <b>پرداخت ثبت شد، اما ساخت اشتراک ناموفق بود</b>`,
    "",
    `${premiumEmoji(PremiumEmoji.RIAL_NOTIFY)} مبلغ شما ثبت شده است. تیم پشتیبانی به‌زودی اشتراک شما را فعال می‌کند.`,
    "",
    `${premiumEmoji(PremiumEmoji.SUPPORT)} در صورت فوری بودن موضوع، از بخش پشتیبانی پیام دهید.`,
  ].join("\n");
}

export function buildOutboundVolumeWalletSuccessMessage({ volumeGb, amountIrt, newBalance }) {
  return [
    `${premiumEmoji(PremiumEmoji.DEPOSIT_SUCCESS)} <b>پرداخت با موفقیت انجام شد</b>`,
    "",
    `${premiumEmoji(PremiumEmoji.STATS_DESC)} <b>حجم خریداری‌شده:</b> ${formatOutboundVolumeText(volumeGb)}`,
    `${premiumEmoji(PremiumEmoji.DEPOSIT_IRT)} <b>مبلغ پرداختی:</b> ${formatToman(amountIrt)} تومان`,
    `${premiumEmoji(PremiumEmoji.WALLET_BALANCE)} <b>موجودی جدید:</b> ${formatToman(newBalance)} تومان`,
    "",
    `${premiumEmoji(PremiumEmoji.RIAL_NOTIFY)} پرداخت شما ثبت شد. جزئیات اشتراک در پیام بعدی ارسال می‌شود.`,
  ].join("\n");
}

export function buildOutboundVolumeCardPaymentMessage(settings, amountIrt) {
  const hasCard = Boolean(settings.cardNumber);
  const hasSheba = Boolean(settings.shebaNumber);
  const amount = formatToman(amountIrt);

  const lines = [
    `${premiumEmoji(PremiumEmoji.RIAL_CARD)} <b>پرداخت کارت به کارت</b>`,
    "",
    `${premiumEmoji(PremiumEmoji.WALLET)} لطفاً <b>دقیقاً مبلغ ${amount} تومان</b> را واریز کنید:`,
    "",
  ];

  if (hasCard) {
    lines.push(
      `${premiumEmoji(PremiumEmoji.TOPUP_BTN_CARD)} <b>شماره کارت:</b>`,
      `<code>${formatCardNumber(settings.cardNumber)}</code>`,
      "",
    );
  }

  if (hasSheba) {
    lines.push(
      `${premiumEmoji(PremiumEmoji.RIAL_SHEBA)} <b>شماره شبا:</b>`,
      `<code>${formatShebaNumber(settings.shebaNumber)}</code>`,
      "",
    );
  }

  lines.push(
    `${premiumEmoji(PremiumEmoji.RIAL_RECEIPT)} پس از واریز، <b>تصویر رسید پرداخت</b> را در همین چت ارسال کنید. پس از بررسی توسط ادمین، سفارش شما تأیید می‌شود.`,
  );

  return lines.join("\n");
}

export const outboundVolumeReceiptReceivedMessage = [
  `${premiumEmoji(PremiumEmoji.RIAL_RECEIPT)} <b>رسید شما دریافت شد</b>`,
  "",
  `${premiumEmoji(PremiumEmoji.RIAL_NOTIFY)} درخواست خرید پس از بررسی ادمین، از طریق ربات به شما اطلاع داده خواهد شد.`,
].join("\n");

export function buildOutboundVolumeCardDisabledMessage() {
  return [
    `${premiumEmoji(PremiumEmoji.TOPUP_DESC)} <b>پرداخت کارت به کارت غیرفعال است</b>`,
    "",
    `${premiumEmoji(PremiumEmoji.OCTOPUS)} در حال حاضر امکان پرداخت کارت به کارت وجود ندارد. از <b>کیف پول</b> استفاده کنید یا با پشتیبانی تماس بگیرید.`,
  ].join("\n");
}
