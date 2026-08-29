import { formatToman } from "../messages/wallet.message.js";
import { formatTrafficGb } from "./traffic-format.js";
import { truncateText } from "./wallet-transaction-format.js";

const MAX_BUTTON_TEXT = 18;

export function formatInvoiceType(serviceType = "outbound") {
  if (serviceType === "panel") return "مصرف پنل";
  if (serviceType === "mixed") return "مصرف ترکیبی";
  return "مصرف اوتباند";
}

export function formatInvoiceStatus() {
  return "پرداخت‌شده";
}

export function formatInvoiceAmount(invoice) {
  return truncateText(`${formatToman(invoice.amountIrt)} تومان`, 22);
}

export function formatInvoiceTraffic(invoice) {
  return truncateText(`${formatTrafficGb(invoice.trafficBytes)} گیگ`, 18);
}

export function formatInvoiceNumber(invoice) {
  return String(invoice.invoiceNumber).padStart(3, "0");
}

export function formatInvoiceNumberLabel(invoice) {
  return `#${formatInvoiceNumber(invoice)}`;
}

export function truncateInvoiceText(text, maxLen = MAX_BUTTON_TEXT) {
  return truncateText(text, maxLen);
}
