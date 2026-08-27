import { log } from '../../lib/logger.js'
import { getTelegramApi } from '../client.js'
import { createTransferSuccessKeyboard } from '../keyboards/transfer-success.js'
import {
  buildTransferReceivedMessage,
  buildTransferSentMessage,
} from '../messages/transfer-success.js'

export interface NotifyTransferCompletedInput {
  transferId: string
  amountToman: bigint
  senderTelegramId: bigint
  recipientTelegramId: bigint
}

export async function notifyTransferCompleted(input: NotifyTransferCompletedInput): Promise<void> {
  const api = getTelegramApi()
  const keyboard = createTransferSuccessKeyboard()
  const sendOptions = {
    parse_mode: 'HTML' as const,
    reply_markup: keyboard,
    link_preview_options: { is_disabled: true },
  }

  const messageInput = {
    amountToman: input.amountToman,
    senderTelegramId: input.senderTelegramId,
    recipientTelegramId: input.recipientTelegramId,
  }

  try {
    await api.sendMessage(
      Number(input.recipientTelegramId),
      buildTransferReceivedMessage(messageInput),
      sendOptions,
    )

    log.bot('transfer received message sent', {
      transferId: input.transferId,
      recipientTelegramId: input.recipientTelegramId.toString(),
    })
  } catch (error) {
    log.error('TRANSFER', 'failed to send received message', {
      transferId: input.transferId,
      recipientTelegramId: input.recipientTelegramId.toString(),
      error: error instanceof Error ? error.message : 'unknown',
    })
  }

  try {
    await api.sendMessage(
      Number(input.senderTelegramId),
      buildTransferSentMessage(messageInput),
      sendOptions,
    )

    log.bot('transfer sent message sent', {
      transferId: input.transferId,
      senderTelegramId: input.senderTelegramId.toString(),
    })
  } catch (error) {
    log.error('TRANSFER', 'failed to send sent message', {
      transferId: input.transferId,
      senderTelegramId: input.senderTelegramId.toString(),
      error: error instanceof Error ? error.message : 'unknown',
    })
  }
}
