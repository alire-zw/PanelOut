import { InlineKeyboard } from 'grammy'
import { PAYMENT_INVOICE_EMOJI } from '../messages/premium-emoji.js'

export function createPaymentInvoiceKeyboard(paymentUrl: string): InlineKeyboard {
  return new InlineKeyboard()
    .url('پرداخت فاکتور (بدون فیلترشکن)', paymentUrl)
    .icon(PAYMENT_INVOICE_EMOJI.card.id)
}
