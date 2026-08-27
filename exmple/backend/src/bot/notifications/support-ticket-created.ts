import type { SupportTicketCategory } from '@prisma/client'
import { env } from '../../config/env.js'
import { log } from '../../lib/logger.js'
import { getTelegramApi } from '../client.js'
import { createSupportTicketKeyboard } from '../keyboards/support-ticket.js'
import { buildSupportTicketCreatedMessage } from '../messages/support-ticket-created.js'

interface NotifySupportTicketCreatedInput {
  telegramId: bigint
  ticketCode: string
  category: SupportTicketCategory
  orderId?: string | null
}

function buildTicketUrl(ticketCode: string): string {
  const base = env.MINI_APP_URL.replace(/\/$/, '')
  return `${base}/support/${encodeURIComponent(ticketCode)}`
}

export async function notifySupportTicketCreated(
  input: NotifySupportTicketCreatedInput,
): Promise<void> {
  try {
    const api = getTelegramApi()
    const chatId = Number(input.telegramId)
    const message = buildSupportTicketCreatedMessage({
      ticketCode: input.ticketCode,
      category: input.category,
      orderId: input.orderId,
    })

    await api.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      reply_markup: createSupportTicketKeyboard(buildTicketUrl(input.ticketCode)),
      link_preview_options: { is_disabled: true },
    })

    log.bot('support ticket created message sent', {
      ticketCode: input.ticketCode,
      telegramId: input.telegramId.toString(),
    })
  } catch (error) {
    log.error('SUPPORT', 'failed to send ticket created message', {
      ticketCode: input.ticketCode,
      error: error instanceof Error ? error.message : 'unknown',
    })
  }
}
