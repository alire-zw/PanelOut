import { PremiumEmoji, premiumEmoji } from "../constants/emojis.js";
import { formatToman } from "./wallet.message.js";

function formatTrx(amountTrx) {
  return Number(amountTrx).toFixed(2);
}

export function buildDepositSuccessMessage({ amountTrx, amountIrt, newBalance }) {
  const trx = formatTrx(amountTrx);
  const irt = formatToman(amountIrt);
  const balance = formatToman(newBalance);

  return [
    `${premiumEmoji(PremiumEmoji.DEPOSIT_SUCCESS)} <b>واریز شما با موفقیت تأیید شد</b>`,
    "",
    `${premiumEmoji(PremiumEmoji.DEPOSIT_TRX)} <b>تعداد ترون واریزی:</b> <code>${trx}</code> TRX`,
    `${premiumEmoji(PremiumEmoji.DEPOSIT_IRT)} <b>معادل ریالی:</b> <code>${irt}</code> تومان`,
    "",
    `${premiumEmoji(PremiumEmoji.DEPOSIT_BALANCE)} <b>موجودی جدید کیف پول:</b> <code>${balance}</code> تومان`,
    "",
    `${premiumEmoji(PremiumEmoji.DEPOSIT_FOOTER)} تراکنش شما با موفقیت در <b>شبکه</b> تأیید و به <b>موجودی حساب</b> اضافه شد. همچنین می‌توانید از طریق دکمه زیر، جزئیات کامل و <b>هش (TXID)</b> تراکنش را مشاهده و پیگیری کنید.`,
  ].join("\n");
}
