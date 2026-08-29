import { InlineKeyboard } from "grammy";
import { CallbackData } from "../constants/callbacks.js";
import { PremiumEmoji } from "../constants/emojis.js";

export function outboundUsageLowBalanceKeyboard() {
  return new InlineKeyboard()
    .text("شارژ کیف پول", CallbackData.WALLET_TOP_UP)
    .icon(PremiumEmoji.WALLET_TOP_UP.id);
}
