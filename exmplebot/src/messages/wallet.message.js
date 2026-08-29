import { PremiumEmoji, premiumEmoji } from "../constants/emojis.js";

export function formatToman(balance) {
  return Number(balance).toLocaleString("en-US");
}

export function buildWalletMessage(userId, balance) {
  const formattedBalance = formatToman(balance);

  return [
    `${premiumEmoji(PremiumEmoji.WALLET_HEADER)} <b>کیف پول شما</b> | آیدی عددی: <code>${userId}</code>`,
    "",
    `${premiumEmoji(PremiumEmoji.WALLET_BALANCE)} <b>موجودی فعلی:</b> <code>${formattedBalance}</code> تومان`,
    "",
    `${premiumEmoji(PremiumEmoji.OCTOPUS)} در این بخش می‌توانید <b>موجودی حساب</b> خود را مدیریت کرده و از طریق دکمه‌های زیر نسبت به <b>افزایش موجودی</b>، مشاهده <b>فاکتورها</b> و بررسی <b>تاریخچه تراکنش‌های مالی</b> خود اقدام کنید. تمامی پرداخت‌ها و گردش‌های مالی حساب <b>به‌صورت خودکار</b> ثبت شده و در هر زمان قابل مشاهده و پیگیری هستند.`,
  ].join("\n");
}
