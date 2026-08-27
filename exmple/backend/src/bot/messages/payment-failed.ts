import {
  PAYMENT_FAILED_EMOJI,
  PAYMENT_SUCCESS_EMOJI,
  tgPremiumEmoji,
} from './premium-emoji.js'

interface PaymentFailedMessageInput {
  amountToman: bigint
  orderId: string
  amountTrx?: string
}

function formatLatinAmount(amountToman: bigint): string {
  return Number(amountToman).toLocaleString('en-US')
}

export function buildPaymentFailedMessage(input: PaymentFailedMessageInput): string {
  const amount = formatLatinAmount(input.amountToman)
  const { cross } = PAYMENT_FAILED_EMOJI
  const { briefcase, plane, receipt } = PAYMENT_SUCCESS_EMOJI

  const lines = [
    `${tgPremiumEmoji(cross.fallback, cross.id)} <b>پرداخت ناموفق بود.</b>`,
    `${tgPremiumEmoji(briefcase.fallback, briefcase.id)} تراکنش شما به دلیل <b>اتمام مهلت پرداخت</b> یا <b>عدم تکمیل پرداخت</b> ناموفق ثبت شد.`,
    `${tgPremiumEmoji(plane.fallback, plane.id)} مبلغ: <code>${amount}</code> تومان`,
  ]

  if (input.amountTrx) {
    lines.push(
      `${tgPremiumEmoji(plane.fallback, plane.id)} مبلغ TRX: <code>${input.amountTrx}</code> TRX`,
    )
  }

  lines.push(
    `${tgPremiumEmoji(receipt.fallback, receipt.id)} شماره سفارش: <code>${input.orderId}</code>`,
  )

  return lines.join('\n\n')
}
