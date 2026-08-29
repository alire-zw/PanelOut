import { InlineKeyboard } from "grammy";
import { CallbackData } from "../constants/callbacks.js";
import { PremiumEmoji } from "../constants/emojis.js";
import { appendBackToMenuRow } from "./back.keyboard.js";

export function walletKeyboard() {
  const keyboard = new InlineKeyboard()
    .text("افزایش موجودی", CallbackData.WALLET_TOP_UP)
    .icon(PremiumEmoji.WALLET_TOP_UP.id)
    .row()
    .text("فاکتورها", CallbackData.WALLET_INVOICES)
    .icon(PremiumEmoji.MANAGE_SERVICES.id)
    .text("تراکنش‌ها", CallbackData.WALLET_TRANSACTIONS)
    .icon(PremiumEmoji.SUPPORT.id);

  keyboard.row();
  appendBackToMenuRow(keyboard);

  return keyboard;
}
