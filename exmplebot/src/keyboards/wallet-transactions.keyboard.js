import { InlineKeyboard } from "grammy";

import {

  CallbackData,

  walletTransactionDetailCallback,

  walletTransactionsPageCallback,

  walletTransactionsRefreshCallback,

} from "../constants/callbacks.js";

import { PremiumEmoji } from "../constants/emojis.js";

import {

  formatTransactionAmount,

  formatTransactionStatus,

  formatTransactionType,

  isTransactionFailed,

  isTransactionSuccess,

  truncateText,

} from "../lib/wallet-transaction-format.js";

import { formatToman } from "../messages/wallet.message.js";

import { formatJalaliDateTime } from "../lib/tehran-time.js";
import { getTronTxExplorerUrl } from "../services/tron/tron-explorer.js";



function getTypeIcon(tx) {

  return tx.type === "tron"

    ? PremiumEmoji.TOPUP_BTN_TRON.id

    : PremiumEmoji.TOPUP_BTN_CARD.id;

}



function headerButton(keyboard, text, icon) {

  keyboard.text(text, CallbackData.WALLET_TX_DISPLAY).icon(icon);

}



function appendStatusButton(keyboard, tx) {

  const statusText = formatTransactionStatus(tx);

  keyboard.text(statusText, CallbackData.WALLET_TX_DISPLAY);



  if (isTransactionSuccess(tx)) {

    keyboard.success();

  } else if (isTransactionFailed(tx)) {

    keyboard.danger();

  } else {

    keyboard.primary();

  }

}



function appendHeaderRow(keyboard) {

  keyboard

    .text("وضعیت", CallbackData.WALLET_TX_DISPLAY)

    .icon(PremiumEmoji.TOPUP_CONFIRM.id)

    .text("مبلغ واریزی", CallbackData.WALLET_TX_DISPLAY)

    .icon(PremiumEmoji.DEPOSIT_IRT.id)

    .text("نوع واریز", CallbackData.WALLET_TX_DISPLAY)

    .icon(PremiumEmoji.RIAL_TOPUP_TITLE.id)

    .row();

}



function appendTransactionRow(keyboard, tx, page) {

  const detailCb = walletTransactionDetailCallback(tx.type, tx.id, page);

  const statusText = formatTransactionStatus(tx);



  keyboard.text(statusText, detailCb);



  if (isTransactionSuccess(tx)) {

    keyboard.success();

  } else if (isTransactionFailed(tx)) {

    keyboard.danger();

  } else {

    keyboard.primary();

  }



  keyboard.text(formatTransactionAmount(tx), detailCb);



  keyboard

    .text(truncateText(formatTransactionType(tx)), detailCb)

    .icon(getTypeIcon(tx));



  keyboard.row();

}



function appendPaginationRow(keyboard, { page, totalPages }) {

  if (totalPages <= 1) {

    return;

  }



  if (page > 0) {

    keyboard

      .text("قبلی", walletTransactionsPageCallback(page - 1))

      .icon(PremiumEmoji.BACK_MENU.id);

  }



  keyboard.text(`صفحه ${page + 1}/${totalPages}`, CallbackData.WALLET_TX_DISPLAY);



  if (page < totalPages - 1) {

    keyboard

      .text("بعدی", walletTransactionsPageCallback(page + 1))

      .icon(PremiumEmoji.MANAGE_SERVICES.id);

  }



  keyboard.row();

}



export function walletTransactionsKeyboard(transactions, { page = 0, totalPages = 1 } = {}) {

  const keyboard = new InlineKeyboard();



  if (transactions.length > 0) {

    appendHeaderRow(keyboard);



    for (const tx of transactions) {

      appendTransactionRow(keyboard, tx, page);

    }



    appendPaginationRow(keyboard, { page, totalPages });

  }



  keyboard

    .text("بروزرسانی", walletTransactionsRefreshCallback(page))

    .icon(PremiumEmoji.STATS_UPDATED.id)

    .row()

    .text("بازگشت به کیف پول", CallbackData.WALLET)

    .icon(PremiumEmoji.BACK_MENU.id);



  return keyboard;

}



export function walletTransactionDetailKeyboard(tx, listPage = 0) {

  const keyboard = new InlineKeyboard();



  headerButton(keyboard, "نوع واریز", PremiumEmoji.RIAL_TOPUP_TITLE.id);

  headerButton(keyboard, "وضعیت", PremiumEmoji.TOPUP_CONFIRM.id);

  keyboard.row();

  keyboard

    .text(truncateText(formatTransactionType(tx)), CallbackData.WALLET_TX_DISPLAY)

    .icon(getTypeIcon(tx));

  appendStatusButton(keyboard, tx);

  keyboard.row();



  if (tx.type === "rial") {
    headerButton(keyboard, "مبلغ واریزی", PremiumEmoji.DEPOSIT_IRT.id);
    headerButton(keyboard, "نوع رسید", PremiumEmoji.RIAL_RECEIPT.id);
    keyboard.row();
    keyboard
      .text(formatTransactionAmount(tx), CallbackData.WALLET_TX_DISPLAY)
      .text(
        truncateText(
          tx.receiptType === "photo" ? "تصویر" : tx.receiptType === "document" ? "فایل" : "—",
        ),
        CallbackData.WALLET_TX_DISPLAY,
      );
    keyboard.row();
  } else {
    headerButton(keyboard, "مبلغ واریزی", PremiumEmoji.DEPOSIT_IRT.id);
    headerButton(keyboard, "هش تراکنش", PremiumEmoji.TOPUP_ADDRESS.id);
    keyboard.row();
    keyboard
      .text(formatTransactionAmount(tx), CallbackData.WALLET_TX_DISPLAY)
      .url(truncateText(tx.txHash, 18), getTronTxExplorerUrl(tx.txHash))
      .icon(PremiumEmoji.DEPOSIT_TX_BTN.id);
    keyboard.row();
  }

  headerButton(keyboard, "تاریخ و ساعت", PremiumEmoji.STATS_DESC.id);

  keyboard.row();

  keyboard.text(formatJalaliDateTime(tx.date), CallbackData.WALLET_TX_DISPLAY);

  keyboard.row();



  if (tx.type === "tron") {

    headerButton(keyboard, "تعداد ترون", PremiumEmoji.DEPOSIT_TRX.id);

    headerButton(keyboard, "نرخ ترون", PremiumEmoji.TOPUP_BTN_TRON.id);

    keyboard.row();

    keyboard

      .text(truncateText(`${tx.amountTrx} TRX`), CallbackData.WALLET_TX_DISPLAY)

      .text(truncateText(`${formatToman(tx.trxPriceIrt)} ت`), CallbackData.WALLET_TX_DISPLAY);

    keyboard.row();

  } else {

    headerButton(keyboard, "زمان بررسی", PremiumEmoji.STATS_UPDATED.id);

    keyboard.row();

    keyboard.text(

      tx.reviewedAt ? formatJalaliDateTime(tx.reviewedAt) : "—",

      CallbackData.WALLET_TX_DISPLAY,

    );

    keyboard.row();

  }



  keyboard

    .text("بازگشت به لیست", walletTransactionsPageCallback(listPage))

    .icon(PremiumEmoji.BACK_MENU.id);



  return keyboard;

}


