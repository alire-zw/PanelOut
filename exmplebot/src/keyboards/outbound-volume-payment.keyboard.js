import { InlineKeyboard } from "grammy";
import {
  CallbackData,
  outboundVolumeAtGbCallback,
  outboundVolumePayCardCallback,
  outboundVolumePaymentCallback,
  outboundVolumePayWalletCallback,
} from "../constants/callbacks.js";
import { PremiumEmoji } from "../constants/emojis.js";

export function outboundVolumePaymentKeyboard(volumeGb, { cardEnabled = true } = {}) {
  const keyboard = new InlineKeyboard()
    .text("پرداخت با کیف پول", outboundVolumePayWalletCallback(volumeGb))
    .icon(PremiumEmoji.WALLET.id)
    .row();

  if (cardEnabled) {
    keyboard
      .text("پرداخت کارت به کارت", outboundVolumePayCardCallback(volumeGb))
      .icon(PremiumEmoji.TOPUP_BTN_CARD.id)
      .row();
  }

  return keyboard
    .text("بازگشت", outboundVolumeAtGbCallback(volumeGb))
    .icon(PremiumEmoji.BACK_MENU.id)
    .text("انصراف", CallbackData.BACK_TO_MENU)
    .icon(PremiumEmoji.CANCEL.id);
}

export function outboundVolumeInsufficientBalanceKeyboard(volumeGb) {
  return new InlineKeyboard()
    .text("شارژ کیف پول", CallbackData.WALLET_TOP_UP)
    .icon(PremiumEmoji.WALLET_TOP_UP.id)
    .row()
    .text("بازگشت", outboundVolumePaymentCallback(volumeGb))
    .icon(PremiumEmoji.BACK_MENU.id);
}

export function outboundVolumeCardPaymentKeyboard(volumeGb) {
  return new InlineKeyboard()
    .text("بازگشت", outboundVolumePaymentCallback(volumeGb))
    .icon(PremiumEmoji.BACK_MENU.id)
    .text("انصراف", CallbackData.BACK_TO_MENU)
    .icon(PremiumEmoji.CANCEL.id);
}

export function outboundVolumeWalletProcessingKeyboard() {
  return new InlineKeyboard();
}

export function outboundVolumeWalletSuccessKeyboard() {
  return new InlineKeyboard()
    .text("بازگشت به منوی اصلی", CallbackData.BACK_TO_MENU)
    .icon(PremiumEmoji.BACK_MENU.id);
}

export function outboundVolumeReceiptReceivedKeyboard() {
  return new InlineKeyboard()
    .text("بازگشت به منوی اصلی", CallbackData.BACK_TO_MENU)
    .icon(PremiumEmoji.BACK_MENU.id);
}
