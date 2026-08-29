import { PremiumEmoji, premiumEmoji } from "../constants/emojis.js";
import { formatJalaliDateTime } from "../lib/tehran-time.js";
import {
  formatReceiptType,
  formatTransactionStatus,
  formatTransactionType,
} from "../lib/wallet-transaction-format.js";
import { getTronTxExplorerUrl } from "../services/tron/tron-explorer.js";
import { formatToman } from "./wallet.message.js";

export function buildWalletTransactionDetailMessage(tx, updatedAt) {
  const lines = [
    `${premiumEmoji(PremiumEmoji.WALLET)} <b>جزئیات تراکنش</b>`,
    "",
    `${premiumEmoji(PremiumEmoji.TOPUP_METHOD_CHOOSE)} <b>نوع:</b> ${formatTransactionType(tx)}`,
    `${premiumEmoji(PremiumEmoji.TOPUP_CONFIRM)} <b>وضعیت:</b> ${formatTransactionStatus(tx)}`,
    `${premiumEmoji(PremiumEmoji.DEPOSIT_IRT)} <b>مبلغ:</b> ${formatToman(tx.amountIrt)} تومان`,
  ];

  if (tx.type === "tron") {
    lines.push(
      `${premiumEmoji(PremiumEmoji.DEPOSIT_TRX)} <b>تعداد ترون:</b> ${tx.amountTrx}`,
      `${premiumEmoji(PremiumEmoji.TOPUP_BTN_TRON)} <b>نرخ ترون:</b> ${formatToman(tx.trxPriceIrt)} تومان`,
      `${premiumEmoji(PremiumEmoji.TOPUP_ADDRESS)} <b>هش تراکنش:</b> <a href="${getTronTxExplorerUrl(tx.txHash)}">اینجا کلیک کنید</a>`,
    );
  } else {
    lines.push(
      `${premiumEmoji(PremiumEmoji.RIAL_RECEIPT)} <b>نوع رسید:</b> ${formatReceiptType(tx.receiptType)}`,
    );

    if (tx.reviewedAt) {
      lines.push(
        `${premiumEmoji(PremiumEmoji.STATS_UPDATED)} <b>زمان بررسی:</b> ${formatJalaliDateTime(tx.reviewedAt)}`,
      );
    }
  }

  lines.push(
    `${premiumEmoji(PremiumEmoji.STATS_DESC)} <b>تاریخ ثبت:</b> ${formatJalaliDateTime(tx.date)}`,
    "",
    `${premiumEmoji(PremiumEmoji.STATS_UPDATED)} آخرین بروزرسانی: ${updatedAt}.`,
  );

  return lines.join("\n");
}
