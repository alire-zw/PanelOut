import { PremiumEmoji, premiumEmoji } from "../constants/emojis.js";
import { formatJalaliDateTime } from "../lib/tehran-time.js";
import { formatTrafficGb } from "../lib/traffic-format.js";
import {
  formatInvoiceNumberLabel,
  formatInvoiceStatus,
  formatInvoiceType,
} from "../lib/wallet-invoice-format.js";
import { formatToman } from "./wallet.message.js";

export function buildWalletInvoiceDetailMessage(invoice, updatedAt) {
  const lines = [
    `${premiumEmoji(PremiumEmoji.WALLET)} <b>جزئیات فاکتور</b>`,
    "",
    `${premiumEmoji(PremiumEmoji.TOPUP_METHOD_CHOOSE)} <b>نوع:</b> ${formatInvoiceType(invoice.serviceType)}`,
    `${premiumEmoji(PremiumEmoji.TOPUP_CONFIRM)} <b>وضعیت:</b> ${formatInvoiceStatus()}`,
    `${premiumEmoji(PremiumEmoji.DEPOSIT_IRT)} <b>مبلغ:</b> ${formatToman(invoice.amountIrt)} تومان`,
    `${premiumEmoji(PremiumEmoji.OUTBOUND_USAGE_ACTIVATE)} <b>حجم مصرف:</b> ${formatTrafficGb(invoice.trafficBytes)} گیگابایت`,
    `${premiumEmoji(PremiumEmoji.STATS_DESC)} <b>تعداد دوره:</b> ${invoice.chargeCount} مورد`,
    `${premiumEmoji(PremiumEmoji.MANAGE_SERVICES)} <b>شماره فاکتور:</b> ${formatInvoiceNumberLabel(invoice)}`,
    `${premiumEmoji(PremiumEmoji.STATS_UPDATED)} <b>از:</b> ${formatJalaliDateTime(invoice.dateFrom)}`,
    `${premiumEmoji(PremiumEmoji.STATS_DESC)} <b>تا:</b> ${formatJalaliDateTime(invoice.dateTo)}`,
    "",
    `${premiumEmoji(PremiumEmoji.STATS_UPDATED)} آخرین بروزرسانی: ${updatedAt}.`,
  ];

  return lines.join("\n");
}
