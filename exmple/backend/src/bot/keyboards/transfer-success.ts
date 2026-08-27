import { InlineKeyboard } from 'grammy'
import { env } from '../../config/env.js'
import { TRANSFER_SUCCESS_EMOJI } from '../messages/premium-emoji.js'

export function createTransferSuccessKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .webApp('ورود به مینی اپ', env.MINI_APP_URL)
    .icon(TRANSFER_SUCCESS_EMOJI.game.id)
}
