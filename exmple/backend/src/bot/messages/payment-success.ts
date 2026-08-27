import { PAYMENT_SUCCESS_EMOJI, tgPremiumEmoji } from './premium-emoji.js'

interface PaymentSuccessMessageInput {
  amountToman: bigint
  orderId: string
}

function formatLatinAmount(amountToman: bigint): string {
  return Number(amountToman).toLocaleString('en-US')
}

export function buildPaymentSuccessMessage(input: PaymentSuccessMessageInput): string {
  const amount = formatLatinAmount(input.amountToman)
  const { check, briefcase, plane, receipt, heart } = PAYMENT_SUCCESS_EMOJI

  return [
    `${tgPremiumEmoji(check.fallback, check.id)} <b>پرداخت شما با موفقیت انجام شد.</b>`,
    `${tgPremiumEmoji(briefcase.fallback, briefcase.id)} تراکنش شما با موفقیت <b>تأیید شد</b> و مبلغ پرداختی به <b>کیف پول</b> شما افزوده گردید.`,
    `${tgPremiumEmoji(plane.fallback, plane.id)} مبلغ شارژ شده: <code>${amount}</code> تومان`,
    `${tgPremiumEmoji(receipt.fallback, receipt.id)} شماره سفارش: <code>${input.orderId}</code>`,
    `${tgPremiumEmoji(heart.fallback, heart.id)} از اعتماد شما سپاسگزاریم. اکنون می‌توانید از موجودی کیف پول خود برای <b>خرید خدمات</b> و <b>ثبت سفارش</b> استفاده کنید.`,
  ].join('\n\n')
}
