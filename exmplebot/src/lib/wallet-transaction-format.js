import { formatToman } from "../messages/wallet.message.js";

const MAX_BUTTON_TEXT = 18;

export function truncateText(text, maxLen = MAX_BUTTON_TEXT) {
  if (text.length <= maxLen) {
    return text;
  }

  return `${text.slice(0, Math.max(1, maxLen - 3))}...`;
}

export function formatTransactionType(tx) {
  if (tx.type === "tron") return "واریز ترون";
  return "واریز ریالی";
}

export function formatTransactionAmount(tx) {
  return truncateText(`${formatToman(tx.amountIrt)} تومان`, 22);
}

export function formatTransactionStatus(tx) {
  if (tx.type === "tron" || tx.status === "approved") {
    return "موفق";
  }

  if (tx.status === "rejected") {
    return "ناموفق";
  }

  return "در انتظار";
}

export function isTransactionSuccess(tx) {
  return tx.type === "tron" || tx.status === "approved";
}

export function isTransactionFailed(tx) {
  return tx.status === "rejected";
}

export function formatReceiptType(type) {
  if (type === "photo") return "تصویر";
  if (type === "document") return "فایل";
  return "—";
}
