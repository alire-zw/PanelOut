import { prisma } from '../../db/client.js'
import { env } from '../../config/env.js'
import { log } from '../../lib/logger.js'
import { getTelegramApi } from '../client.js'
import { createCryptoPaymentInvoiceKeyboard } from '../keyboards/crypto-payment-invoice.js'
import { buildCryptoPaymentInvoiceMessage } from '../messages/crypto-payment-invoice.js'

interface NotifyCryptoPaymentInvoiceInput {
  paymentId: number
  telegramId: bigint
  amountToman: bigint
  amountTrx: string
  orderId: string
}

function buildCryptoPaymentPageUrl(orderId: string): string {
  const base = env.MINI_APP_URL.replace(/\/$/, '')
  return `${base}/wallet/charge/tron?orderId=${encodeURIComponent(orderId)}`
}

async function saveInvoiceMessageIds(
  paymentId: number,
  chatId: number,
  messageId: number,
): Promise<void> {
  try {
    await prisma.cryptoPayment.update({
      where: { id: paymentId },
      data: {
        invoiceChatId: BigInt(chatId),
        invoiceMessageId: messageId,
      },
    })
    return
  } catch (error) {
    log.error('CRYPTO', 'prisma update failed for invoice message ids, trying raw SQL', {
      paymentId,
      error: error instanceof Error ? error.message : 'unknown',
    })
  }

  await prisma.$executeRaw`
    UPDATE crypto_payments
    SET invoice_chat_id = ${BigInt(chatId)}, invoice_message_id = ${messageId}
    WHERE id = ${paymentId}
  `
}

export async function notifyCryptoPaymentInvoiceCreated(
  input: NotifyCryptoPaymentInvoiceInput,
): Promise<void> {
  const api = getTelegramApi()
  const chatId = Number(input.telegramId)
  const paymentPageUrl = buildCryptoPaymentPageUrl(input.orderId)

  let sentMessage
  try {
    const message = buildCryptoPaymentInvoiceMessage({
      amountToman: input.amountToman,
      amountTrx: input.amountTrx,
      orderId: input.orderId,
    })

    sentMessage = await api.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      reply_markup: createCryptoPaymentInvoiceKeyboard(paymentPageUrl),
      link_preview_options: { is_disabled: true },
    })
  } catch (error) {
    log.error('CRYPTO', 'failed to send invoice message', {
      telegramId: input.telegramId.toString(),
      orderId: input.orderId,
      error: error instanceof Error ? error.message : 'unknown',
    })
    return
  }

  try {
    await saveInvoiceMessageIds(input.paymentId, chatId, sentMessage.message_id)
  } catch (error) {
    log.error('CRYPTO', 'failed to save invoice message ids', {
      paymentId: input.paymentId,
      telegramId: input.telegramId.toString(),
      orderId: input.orderId,
      messageId: sentMessage.message_id,
      error: error instanceof Error ? error.message : 'unknown',
    })
    return
  }

  log.bot('crypto payment invoice sent', {
    telegramId: input.telegramId.toString(),
    orderId: input.orderId,
    messageId: sentMessage.message_id,
  })
}
