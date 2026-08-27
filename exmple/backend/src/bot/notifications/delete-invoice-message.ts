import { getTelegramApi } from '../client.js'
import { log } from '../../lib/logger.js'

export async function deleteTelegramInvoiceMessage(input: {
  chatId: bigint | null | undefined
  messageId: number | null | undefined
  scope: string
  orderId: string
  paymentId: number
}): Promise<void> {
  if (!input.chatId || !input.messageId) {
    return
  }

  try {
    await getTelegramApi().deleteMessage(Number(input.chatId), input.messageId)
    log.bot('payment invoice message deleted', {
      scope: input.scope,
      paymentId: input.paymentId,
      orderId: input.orderId,
      messageId: input.messageId,
    })
  } catch (error) {
    log.error(input.scope, 'failed to delete invoice message', {
      paymentId: input.paymentId,
      orderId: input.orderId,
      error: error instanceof Error ? error.message : 'unknown',
    })
  }
}
