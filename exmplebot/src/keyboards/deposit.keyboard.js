import { InlineKeyboard } from "grammy";
import { CallbackData } from "../constants/callbacks.js";
import { PremiumEmoji } from "../constants/emojis.js";
import { getTronTxExplorerUrl } from "../services/tron/tron-explorer.js";

export function depositSuccessKeyboard(txHash) {
  return new InlineKeyboard()
    .url("مشاهده ‌هش تراکنش", getTronTxExplorerUrl(txHash))
    .icon(PremiumEmoji.DEPOSIT_TX_BTN.id)
    .row()
    .text("بازگشت به منوی اصلی", CallbackData.BACK_TO_MENU)
    .icon(PremiumEmoji.BACK_MENU.id);
}
