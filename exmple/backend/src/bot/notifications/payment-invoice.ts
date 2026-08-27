import { prisma } from '../../db/client.js'
import { log } from '../../lib/logger.js'
import { getTelegramApi } from '../client.js'
import { createPaymentInvoiceKeyboard } from '../keyboards/payment-invoice.js'
import { buildPaymentInvoiceMessage } from '../messages/payment-invoice.js'

interface NotifyPaymentInvoiceInput {
  paymentId: number
  telegramId: bigint
  amountToman: bigint
  orderId: string
  paymentUrl: string
  trackId: string
}

async function saveInvoiceMessageIds(
  paymentId: number,
  chatId: number,
  messageId: number,
): Promise<void> {
  try {
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        invoiceChatId: BigInt(chatId),
        invoiceMessageId: messageId,
      },
    })
    return
  } catch (error) {
    log.error('PAYMENT', 'prisma update failed for invoice message ids, trying raw SQL', {
      paymentId,
      error: error instanceof Error ? error.message : 'unknown',
    })
  }

  await prisma.$executeRaw`
    UPDATE payments
    SET invoice_chat_id = ${BigInt(chatId)}, invoice_message_id = ${messageId}
    WHERE id = ${paymentId}
  `
}

export async function notifyPaymentInvoiceCreated(input: NotifyPaymentInvoiceInput): Promise<void> {
  const api = getTelegramApi()
  const chatId = Number(input.telegramId)

  let sentMessage
  try {
    const message = buildPaymentInvoiceMessage({
      amountToman: input.amountToman,
      orderId: input.orderId,
    })

    sentMessage = await api.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      reply_markup: createPaymentInvoiceKeyboard(input.paymentUrl),
      link_preview_options: { is_disabled: true },
    })
  } catch (error) {
    log.error('PAYMENT', 'failed to send invoice message', {
      telegramId: input.telegramId.toString(),
      orderId: input.orderId,
      error: error instanceof Error ? error.message : 'unknown',
    })
    return
  }

  try {
    await saveInvoiceMessageIds(input.paymentId, chatId, sentMessage.message_id)
  } catch (error) {
    log.error('PAYMENT', 'failed to save invoice message ids', {
      paymentId: input.paymentId,
      telegramId: input.telegramId.toString(),
      orderId: input.orderId,
      messageId: sentMessage.message_id,
      error: error instanceof Error ? error.message : 'unknown',
    })
    return
  }

  log.bot('payment invoice sent', {
    telegramId: input.telegramId.toString(),
    orderId: input.orderId,
    trackId: input.trackId,
    messageId: sentMessage.message_id,
  })
}