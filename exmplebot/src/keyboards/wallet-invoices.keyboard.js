import { InlineKeyboard } from "grammy";

import {
  CallbackData,
  walletInvoiceDetailCallback,
  walletInvoicesPageCallback,
  walletInvoicesRefreshCallback,
} from "../constants/callbacks.js";
import { PremiumEmoji } from "../constants/emojis.js";
import { formatJalaliDateTime } from "../lib/tehran-time.js";
import {
  formatInvoiceAmount,
  formatInvoiceNumberLabel,
  formatInvoiceStatus,
  formatInvoiceType,
  truncateInvoiceText,
} from "../lib/wallet-invoice-format.js";
import { formatTrafficGb } from "../lib/traffic-format.js";

function headerButton(keyboard, text, icon) {
  keyboard.text(text, CallbackData.WALLET_INVOICE_DISPLAY).icon(icon);
}

function appendStatusButton(keyboard) {
  keyboard
    .text(formatInvoiceStatus(), CallbackData.WALLET_INVOICE_DISPLAY)
    .success();
}

function appendHeaderRow(keyboard) {
  keyboard
    .text("وضعیت", CallbackData.WALLET_INVOICE_DISPLAY)
    .icon(PremiumEmoji.TOPUP_CONFIRM.id)
    .text("مبلغ", CallbackData.WALLET_INVOICE_DISPLAY)
    .icon(PremiumEmoji.DEPOSIT_IRT.id)
    .text("شماره فاکتور", CallbackData.WALLET_INVOICE_DISPLAY)
    .icon(PremiumEmoji.MANAGE_SERVICES.id)
    .row();
}

function appendInvoiceRow(keyboard, invoice, page) {
  const detailCb = walletInvoiceDetailCallback(invoice.anchorChargeId, page);

  keyboard.text(formatInvoiceStatus(), detailCb).success();
  keyboard.text(formatInvoiceAmount(invoice), detailCb);
  keyboard
    .text(truncateInvoiceText(formatInvoiceNumberLabel(invoice)), detailCb)
    .icon(PremiumEmoji.SERVICE_OUTBOUND_BTN.id);
  keyboard.row();
}

function appendPaginationRow(keyboard, { page, totalPages }) {
  if (totalPages <= 1) {
    return;
  }

  if (page > 0) {
    keyboard
      .text("قبلی", walletInvoicesPageCallback(page - 1))
      .icon(PremiumEmoji.BACK_MENU.id);
  }

  keyboard.text(`صفحه ${page + 1}/${totalPages}`, CallbackData.WALLET_INVOICE_DISPLAY);

  if (page < totalPages - 1) {
    keyboard
      .text("بعدی", walletInvoicesPageCallback(page + 1))
      .icon(PremiumEmoji.MANAGE_SERVICES.id);
  }

  keyboard.row();
}

export function walletInvoicesKeyboard(invoices, { page = 0, totalPages = 1 } = {}) {
  const keyboard = new InlineKeyboard();

  if (invoices.length > 0) {
    appendHeaderRow(keyboard);

    for (const invoice of invoices) {
      appendInvoiceRow(keyboard, invoice, page);
    }

    appendPaginationRow(keyboard, { page, totalPages });
  }

  keyboard
    .text("بروزرسانی", walletInvoicesRefreshCallback(page))
    .icon(PremiumEmoji.STATS_UPDATED.id)
    .row()
    .text("بازگشت به کیف پول", CallbackData.WALLET)
    .icon(PremiumEmoji.BACK_MENU.id);

  return keyboard;
}

export function walletInvoiceDetailKeyboard(invoice, listPage = 0) {
  const keyboard = new InlineKeyboard();

  headerButton(keyboard, "نوع فاکتور", PremiumEmoji.SERVICE_OUTBOUND_BTN.id);
  headerButton(keyboard, "وضعیت", PremiumEmoji.TOPUP_CONFIRM.id);
  keyboard.row();

  keyboard
    .text(truncateInvoiceText(formatInvoiceType()), CallbackData.WALLET_INVOICE_DISPLAY)
    .icon(PremiumEmoji.OUTBOUND_USAGE_ACTIVATE.id);
  appendStatusButton(keyboard);
  keyboard.row();

  headerButton(keyboard, "مبلغ", PremiumEmoji.DEPOSIT_IRT.id);
  headerButton(keyboard, "حجم مصرف", PremiumEmoji.OUTBOUND_USAGE_ACTIVATE.id);
  keyboard.row();
  keyboard
    .text(formatInvoiceAmount(invoice), CallbackData.WALLET_INVOICE_DISPLAY)
    .text(
      truncateInvoiceText(`${formatTrafficGb(invoice.trafficBytes)} گیگابایت`, 22),
      CallbackData.WALLET_INVOICE_DISPLAY,
    );
  keyboard.row();

  headerButton(keyboard, "تعداد دوره", PremiumEmoji.STATS_DESC.id);
  headerButton(keyboard, "شماره فاکتور", PremiumEmoji.MANAGE_SERVICES.id);
  keyboard.row();
  keyboard
    .text(`${invoice.chargeCount} مورد`, CallbackData.WALLET_INVOICE_DISPLAY)
    .text(formatInvoiceNumberLabel(invoice), CallbackData.WALLET_INVOICE_DISPLAY);
  keyboard.row();

  headerButton(keyboard, "از تاریخ", PremiumEmoji.STATS_UPDATED.id);
  keyboard.row();
  keyboard.text(formatJalaliDateTime(invoice.dateFrom), CallbackData.WALLET_INVOICE_DISPLAY);
  keyboard.row();

  headerButton(keyboard, "تا تاریخ", PremiumEmoji.STATS_DESC.id);
  keyboard.row();
  keyboard.text(formatJalaliDateTime(invoice.dateTo), CallbackData.WALLET_INVOICE_DISPLAY);
  keyboard.row();

  keyboard
    .text("بازگشت به لیست", walletInvoicesPageCallback(listPage))
    .icon(PremiumEmoji.BACK_MENU.id);

  return keyboard;
}
