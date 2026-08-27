import { InlineKeyboard } from 'grammy'
import { PAYMENT_INVOICE_EMOJI } from '../messages/premium-emoji.js'

export function createCryptoPaymentInvoiceKeyboard(paymentPageUrl: string): InlineKeyboard {
  return new InlineKeyboard()
    .webApp('ادامه پرداخت ترون', paymentPageUrl)
    .icon(PAYMENT_INVOICE_EMOJI.card.id)
}
