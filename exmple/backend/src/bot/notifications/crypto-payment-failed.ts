import { prisma } from '../../db/client.js'
import { log } from '../../lib/logger.js'
import { getTelegramApi } from '../client.js'
import { createPaymentSuccessKeyboard } from '../keyboards/payment-success.js'
import { buildPaymentFailedMessage } from '../messages/payment-failed.js'

export async function notifyCryptoPaymentFailed(paymentId: number): Promise<void> {
  try {
    const payment = await prisma.cryptoPayment.findUnique({
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
        log.bot('crypto payment invoice message deleted', {
          paymentId,
          orderId: payment.orderId,
          messageId: payment.invoiceMessageId,
        })
      } catch (error) {
        log.error('CRYPTO', 'failed to delete invoice message', {
          paymentId,
          orderId: payment.orderId,
          error: error instanceof Error ? error.message : 'unknown',
        })
      }
    }

    const message = buildPaymentFailedMessage({
      amountToman: payment.amountToman,
      orderId: payment.orderId,
      amountTrx: payment.amountTrx,
    })

    await api.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      reply_markup: createPaymentSuccessKeyboard(),
      link_preview_options: { is_disabled: true },
    })

    log.bot('crypto payment failed message sent', {
      paymentId,
      orderId: payment.orderId,
      telegramId: payment.user.telegramId.toString(),
    })
  } catch (error) {
    log.error('CRYPTO', 'failed to send payment failed message', {
      paymentId,
      error: error instanceof Error ? error.message : 'unknown',
    })
  }
}
