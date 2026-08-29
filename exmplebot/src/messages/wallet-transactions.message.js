import { PremiumEmoji, premiumEmoji } from "../constants/emojis.js";
import { formatJalaliDateTime } from "../lib/tehran-time.js";

export function buildWalletTransactionsMessage(
  updatedAt,
  hasTransactions,
  { page = 0, totalPages = 1, totalCount = 0 } = {},
) {
  const lines = [
    `${premiumEmoji(PremiumEmoji.WALLET)} <b>تراکنش‌های کیف پول</b>`,
    "",
  ];

  if (!hasTransactions) {
    lines.push(
      `${premiumEmoji(PremiumEmoji.TOPUP_DESC)} هنوز <b>تراکنشی</b> ثبت نشده است. از بخش «افزایش موجودی» می‌توانید کیف پول خود را شارژ کنید.`,
    );
  } else {
    lines.push(
      `${premiumEmoji(PremiumEmoji.MANAGE_SERVICES)} لیست <b>واریزهای ترون و ریالی</b> شما در دکمه‌های زیر نمایش داده می‌شود. برای مشاهده <b>جزئیات</b> هر تراکنش روی آن کلیک کنید.`,
    );

    if (totalPages > 1) {
      lines.push(
        "",
        `${premiumEmoji(PremiumEmoji.STATS_DESC)} نمایش <b>${page + 1}</b> از <b>${totalPages}</b> صفحه — مجموع <b>${totalCount}</b> تراکنش.`,
      );
    }
  }

  lines.push(
    "",
    `${premiumEmoji(PremiumEmoji.STATS_UPDATED)} آخرین بروزرسانی: ${updatedAt}.`,
  );

  return lines.join("\n");
}
