import { InlineKeyboard } from 'grammy'
import { PAYMENT_SUCCESS_EMOJI } from '../messages/premium-emoji.js'

export function createSupportTicketKeyboard(ticketUrl: string): InlineKeyboard {
  return new InlineKeyboard()
    .webApp('مشاهده تیکت', ticketUrl)
    .icon(PAYMENT_SUCCESS_EMOJI.game.id)
}
