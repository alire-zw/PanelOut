import { InlineKeyboard } from 'grammy'
import { PAYMENT_SUCCESS_EMOJI } from '../messages/premium-emoji.js'

/** Channel posts cannot use web_app buttons — URL + styled glass button only. */
export function createAdminTicketReportKeyboard(miniAppDeepLink: string): InlineKeyboard {
  return new InlineKeyboard()
    .url('Open Mini App', miniAppDeepLink)
    .primary()
    .icon(PAYMENT_SUCCESS_EMOJI.game.id)
}
