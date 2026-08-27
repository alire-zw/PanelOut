import { InlineKeyboard } from 'grammy'
import { PAYMENT_SUCCESS_EMOJI } from '../messages/premium-emoji.js'

export function createAccountShopOrderKeyboard(orderUrl: string): InlineKeyboard {
  return new InlineKeyboard()
    .webApp('مشاهده سفارش', orderUrl)
    .icon(PAYMENT_SUCCESS_EMOJI.game.id)
}
