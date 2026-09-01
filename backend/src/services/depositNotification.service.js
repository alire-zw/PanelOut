import { getBotApi } from "../bot/api.js";
import { emoji, WALLET_EMOJI } from "../bot/messages/premiumEmoji.js";
import { log } from "../lib/logger.js";
import { getTronTxExplorerUrl } from "./tron/tron-explorer.js";

function formatToman(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function formatTrx(amountTrx) {
  return Number(amountTrx).toFixed(2);
}

function buildDepositSuccessMessage({ amountTrx, amountIrt, newBalance }) {
  const { check, plane, money, briefcase } = WALLET_EMOJI;

  return [
    `${emoji(check)} <b>واریز شما با موفقیت تأیید شد</b>`,
    "",
    `${emoji(plane)} <b>تعداد ترون واریزی:</b> <code>${formatTrx(amountTrx)}</code> TRX`,
    `${emoji(money)} <b>معادل ریالی:</b> <code>${formatToman(amountIrt)}</code> تومان`,
    "",
    `${emoji(briefcase)} <b>موجودی جدید کیف پول:</b> <code>${formatToman(newBalance)}</code> تومان`,
    "",
    "تراکنش شما در شبکه ترون تأیید و به موجودی حساب اضافه شد.",
  ].join("\n");
}

export async function notifyDepositSuccess({
  telegramUserId,
  amountTrx,
  amountIrt,
  newBalance,
  txHash,
}) {
  try {
    const api = getBotApi();
    const explorerUrl = getTronTxExplorerUrl(txHash);

    await api.sendMessage(Number(telegramUserId), buildDepositSuccessMessage({
      amountTrx,
      amountIrt,
      newBalance,
    }), {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[{ text: "🔍 مشاهده در Tronscan", url: explorerUrl }]],
      },
    });

    log.event("notify", `deposit sent tg:${telegramUserId}`);
  } catch (err) {
    log.warn("notify", `deposit fail tg:${telegramUserId} · ${err.message}`);
  }
}
