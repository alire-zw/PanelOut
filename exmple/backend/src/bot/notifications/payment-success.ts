import { prisma } from '../../db/client.js'
import { log } from '../../lib/logger.js'
import { getTelegramApi } from '../client.js'
import { createPaymentSuccessKeyboard } from '../keyboards/payment-success.js'
import { buildPaymentSuccessMessage } from '../messages/payment-success.js'

function rialToToman(amountRial: bigint): bigint {
  return amountRial / 10n
}

export async function notifyPaymentSucceeded(paymentId: number): Promise<void> {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { user: true },
    })

    if (!payment) {
      return
    }

    const api = getTelegramApi()
    const chatId = Number(payment.user.telegramId)

    if (payment.invoiceChatId && payment.invoiceMessageId) {
      try {
        await api.deleteMessage(Number(payment.invoiceChatId), payment.invoiceMessageId)
        log.bot('payment invoice message deleted', {
          paymentId,
          orderId: payment.orderId,
          messageId: payment.invoiceMessageId,
        })
      } catch (error) {
        log.error('PAYMENT', 'failed to delete invoice message', {
          paymentId,
          orderId: payment.orderId,
          error: error instanceof Error ? error.message : 'unknown',
        })
      }
    }

    const message = buildPaymentSuccessMessage({
      amountToman: rialToToman(payment.amount),
      orderId: payment.orderId,
    })

    await api.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      reply_markup: createPaymentSuccessKeyboard(),
      link_preview_options: { is_disabled: true },
    })

    log.bot('payment success message sent', {
      paymentId,
      orderId: payment.orderId,
      telegramId: payment.user.telegramId.toString(),
    })
  } catch (error) {
    log.error('PAYMENT', 'failed to send success message', {
      paymentId,
      error: error instanceof Error ? error.message : 'unknown',
    })
  }
}
