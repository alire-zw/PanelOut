import { PAYMENT_INVOICE_EMOJI, tgPremiumEmoji } from './premium-emoji.js'

interface PaymentInvoiceMessageInput {
  amountToman: bigint
  orderId: string
}

function formatLatinAmount(amountToman: bigint): string {
  return Number(amountToman).toLocaleString('en-US')
}

export function buildPaymentInvoiceMessage(input: PaymentInvoiceMessageInput): string {
  const amount = formatLatinAmount(input.amountToman)
  const { pen, card, money, receipt, briefcase } = PAYMENT_INVOICE_EMOJI

  return [
    `${tgPremiumEmoji(pen.fallback, pen.id)} <b>فاکتور پرداخت شما با موفقیت ایجاد شد.</b>`,
    `${tgPremiumEmoji(card.fallback, card.id)} برای <b>تکمیل سفارش</b>، کافی است از طریق دکمه زیر وارد <b>درگاه پرداخت امن</b> شوید و مبلغ فاکتور را پرداخت کنید. این پرداخت <b>بدون نیاز به فیلترشکن</b> انجام می‌شود.`,
    `${tgPremiumEmoji(money.fallback, money.id)} مبلغ قابل پرداخت: <code>${amount}</code> تومان`,
    `${tgPremiumEmoji(receipt.fallback, receipt.id)} شماره سفارش: <code>${input.orderId}</code>`,
    `${tgPremiumEmoji(briefcase.fallback, briefcase.id)} پس از پرداخت موفق، تراکنش به‌صورت <b>خودکار</b> بررسی شده و موجودی کیف پول شما در <b>کوتاه‌ترین زمان ممکن</b> شارژ خواهد شد.`,
  ].join('\n\n')
}
