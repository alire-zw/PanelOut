import { InlineKeyboard } from 'grammy'
import { env } from '../../config/env.js'
import { PAYMENT_SUCCESS_EMOJI } from '../messages/premium-emoji.js'

export function createPaymentSuccessKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .webApp('ورود به مینی اپ', env.MINI_APP_URL)
    .icon(PAYMENT_SUCCESS_EMOJI.game.id)
}
