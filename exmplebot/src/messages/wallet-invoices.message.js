import { PremiumEmoji, premiumEmoji } from "../constants/emojis.js";
import { USAGE_INVOICE_BATCH_SIZE } from "../constants/wallet-invoices.js";

export function buildWalletInvoicesMessage(
  updatedAt,
  hasInvoices,
  { page = 0, totalPages = 1, totalCount = 0 } = {},
) {
  const lines = [
    `${premiumEmoji(PremiumEmoji.MANAGE_SERVICES)} <b>فاکتورهای مصرف</b>`,
    "",
  ];

  if (!hasInvoices) {
    lines.push(
      `${premiumEmoji(PremiumEmoji.TOPUP_DESC)} هنوز <b>فاکتوری</b> برای مصرف ثبت نشده است.`,
    );
  } else {
    lines.push(
      `${premiumEmoji(PremiumEmoji.SERVICE_OUTBOUND_BTN)} فاکتورهای <b>مصرف اوتباند و پنل</b> شما در دکمه‌های زیر نمایش داده می‌شود. هر فاکتور حداکثر <b>${USAGE_INVOICE_BATCH_SIZE}</b> دوره صورتحساب را تجمیع می‌کند.`,
    );

    if (totalPages > 1) {
      lines.push(
        "",
        `${premiumEmoji(PremiumEmoji.STATS_DESC)} نمایش <b>${page + 1}</b> از <b>${totalPages}</b> صفحه — مجموع <b>${totalCount}</b> فاکتور.`,
      );
    }
  }

  lines.push(
    "",
    `${premiumEmoji(PremiumEmoji.STATS_UPDATED)} آخرین بروزرسانی: ${updatedAt}.`,
  );

  return lines.join("\n");
}
