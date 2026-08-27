import { TRANSFER_SUCCESS_EMOJI, tgPremiumEmoji } from './premium-emoji.js'

interface TransferMessageInput {
  amountToman: bigint
  senderTelegramId: bigint
  recipientTelegramId: bigint
}

function formatLatinAmount(amountToman: bigint): string {
  return Number(amountToman).toLocaleString('en-US')
}

function formatTelegramId(telegramId: bigint): string {
  return telegramId.toString()
}

export function buildTransferReceivedMessage(input: TransferMessageInput): string {
  const amount = formatLatinAmount(input.amountToman)
  const senderId = formatTelegramId(input.senderTelegramId)
  const { briefcase, eyes, check } = TRANSFER_SUCCESS_EMOJI

  return [
    `${tgPremiumEmoji(briefcase.fallback, briefcase.id)} <b>دریافت موجودی با موفقیت انجام شد.</b>`,
    `${tgPremiumEmoji(eyes.fallback, eyes.id)} کاربر با شناسه <code>${senderId}</code> مبلغ <code>${amount}</code> تومان را از <b>کیف پول</b> خود به <b>کیف پول شما</b> انتقال داد.`,
    `${tgPremiumEmoji(check.fallback, check.id)} <b>موجودی کیف پول شما</b> با موفقیت به‌روزرسانی شد.`,
  ].join('\n\n')
}

export function buildTransferSentMessage(input: TransferMessageInput): string {
  const amount = formatLatinAmount(input.amountToman)
  const recipientId = formatTelegramId(input.recipientTelegramId)
  const { check, plane, calc } = TRANSFER_SUCCESS_EMOJI

  return [
    `${tgPremiumEmoji(check.fallback, check.id)} <b>ارسال موجودی با موفقیت انجام شد.</b>`,
    `${tgPremiumEmoji(plane.fallback, plane.id)} مبلغ <code>${amount}</code> تومان با موفقیت از <b>کیف پول شما</b> به کاربر با شناسه <code>${recipientId}</code> منتقل شد.`,
    `${tgPremiumEmoji(calc.fallback, calc.id)} از این لحظه موجودی <b>کیف پول</b> هر دو طرف به‌روزرسانی شده است.`,
  ].join('\n\n')
}
