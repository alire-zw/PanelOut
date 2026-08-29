import { PremiumEmoji, premiumEmoji } from "../constants/emojis.js";
import { MIN_RIAL_DEPOSIT_TOMAN } from "../lib/parse-amount.js";
import { formatToman } from "./wallet.message.js";
import {
  formatCardNumber,
  formatShebaNumber,
} from "../services/payment-settings.service.js";

export const walletRialAmountPromptMessage = [
  `${premiumEmoji(PremiumEmoji.RIAL_TOPUP_TITLE)} <b>افزایش موجودی ریالی</b>`,
  "",
  `${premiumEmoji(PremiumEmoji.MANAGE_SERVICES)} لطفاً <b>مبلغ واریز</b> را به <b>تومان</b> در یک پیام ارسال کنید.`,
  "",
  `${premiumEmoji(PremiumEmoji.TOPUP_METHOD_CHOOSE)} <b>حداقل مبلغ واریز:</b> <code>${formatToman(MIN_RIAL_DEPOSIT_TOMAN)}</code> تومان`,
].join("\n");


function buildDepositIntro(amountIrt, hasCard, hasSheba) {
  const amount = formatToman(amountIrt);

  if (hasCard && hasSheba) {
    return `${premiumEmoji(PremiumEmoji.WALLET)} مبلغ <code>${amount}</code> تومان را به <b>شماره کارت یا شبای</b> زیر واریز کنید:`;
  }

  if (hasCard) {
    return `${premiumEmoji(PremiumEmoji.WALLET)} مبلغ <code>${amount}</code> تومان را به <b>شماره کارت</b> زیر واریز کنید:`;
  }

  return `${premiumEmoji(PremiumEmoji.WALLET)} مبلغ <code>${amount}</code> تومان را به <b>شماره شبای</b> زیر واریز کنید:`;
}

function buildMethodHints(hasCard, hasSheba) {
  const lines = [];

  if (hasCard) {
    lines.push(
      `${premiumEmoji(PremiumEmoji.OCTOPUS)} برای واریز به <b>شماره کارت</b> از روش <b>کارت به کارت</b> یا <b>پل</b> استفاده کنید.`,
    );
  }

  if (hasSheba) {
    lines.push(
      `${premiumEmoji(PremiumEmoji.RIAL_SHEBA)} برای واریز به <b>شماره شبا</b> از روش <b>پل</b> یا <b>ساتنا</b> استفاده کنید. در صورت انجام واریز از طریق <b>پایا</b>، ممکن است تأیید تراکنش با <b>تأخیر</b> همراه باشد.`,
    );
  }

  return lines.join("\n");
}

export function buildWalletRialTopUpMessage(settings, amountIrt) {
  const hasCard = Boolean(settings.cardNumber);
  const hasSheba = Boolean(settings.shebaNumber);
  const lines = [
    `${premiumEmoji(PremiumEmoji.RIAL_TOPUP_TITLE)} <b>افزایش موجودی ریالی</b>`,
    "",
    buildDepositIntro(amountIrt, hasCard, hasSheba),
    "",
  ];

  if (hasCard) {
    lines.push(
      `${premiumEmoji(PremiumEmoji.RIAL_CARD)} <b>شماره کارت:</b>`,
      `<code>${formatCardNumber(settings.cardNumber)}</code>`,
    );
  }

  if (hasSheba) {
    lines.push(
      `${premiumEmoji(PremiumEmoji.RIAL_SHEBA)} <b>شماره شبا:</b>`,
      `<code>${formatShebaNumber(settings.shebaNumber)}</code>`,
    );
  }

  const methodHints = buildMethodHints(hasCard, hasSheba);

  if (methodHints) {
    lines.push("", methodHints);
  }

  lines.push(
    "",
    `${premiumEmoji(PremiumEmoji.RIAL_RECEIPT)} پس از انجام واریز، <b>تصویر یا رسید پرداخت</b> را در ادامه همین پیام ارسال نمایید. درخواست شما پس از بررسی و تأیید توسط ادمین ثبت شده و موجودی حساب به‌روزرسانی خواهد شد.`,
    "",
    `${premiumEmoji(PremiumEmoji.RIAL_NOTIFY)} نتیجه بررسی و وضعیت شارژ حساب از طریق ربات به شما اطلاع داده می‌شود.`,
  );

  return lines.join("\n");
}
