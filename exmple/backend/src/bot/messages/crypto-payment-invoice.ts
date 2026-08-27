import { PAYMENT_INVOICE_EMOJI, PAYMENT_SUCCESS_EMOJI, tgPremiumEmoji } from './premium-emoji.js'

interface CryptoPaymentInvoiceMessageInput {
  amountToman: bigint
  amountTrx: string
  orderId: string
}

function formatLatinAmount(amountToman: bigint): string {
  return Number(amountToman).toLocaleString('en-US')
}

export function buildCryptoPaymentInvoiceMessage(input: CryptoPaymentInvoiceMessageInput): string {
  const amount = formatLatinAmount(input.amountToman)
  const { pen, card, money, receipt, briefcase } = PAYMENT_INVOICE_EMOJI
  const { plane } = PAYMENT_SUCCESS_EMOJI

  return [
    `${tgPremiumEmoji(pen.fallback, pen.id)} <b>فاکتور پرداخت شما با موفقیت ایجاد شد.</b>`,
    `${tgPremiumEmoji(card.fallback, card.id)} برای <b>تکمیل سفارش</b>، از طریق دکمه زیر وارد <b>صفحه پرداخت ترون</b> شوید و مبلغ فاکتور را به آدرس اختصاصی خود ارسال کنید.`,
    `${tgPremiumEmoji(money.fallback, money.id)} مبلغ قابل پرداخت: <code>${amount}</code> تومان`,
    `${tgPremiumEmoji(plane.fallback, plane.id)} مبلغ TRX: <code>${input.amountTrx}</code> TRX`,
    `${tgPremiumEmoji(receipt.fallback, receipt.id)} شماره سفارش: <code>${input.orderId}</code>`,
    `${tgPremiumEmoji(briefcase.fallback, briefcase.id)} پس از پرداخت موفق، تراکنش به‌صورت <b>خودکار</b> بررسی شده و موجودی کیف پول شما در <b>کوتاه‌ترین زمان ممکن</b> شارژ خواهد شد.`,
  ].join('\n\n')
}
