import type { SupportTicketCategory } from '@prisma/client'
import { env } from '../../config/env.js'
import { log } from '../../lib/logger.js'
import { getTelegramApi } from '../client.js'
import { createSupportTicketKeyboard } from '../keyboards/support-ticket.js'
import { buildSupportTicketAnsweredMessage } from '../messages/support-ticket-answered.js'

interface NotifySupportTicketAnsweredInput {
  telegramId: bigint
  ticketCode: string
  category: SupportTicketCategory
  preview: string
}

function buildTicketUrl(ticketCode: string): string {
  const base = env.MINI_APP_URL.replace(/\/$/, '')
  return `${base}/support/${encodeURIComponent(ticketCode)}`
}

export async function notifySupportTicketAnswered(
  input: NotifySupportTicketAnsweredInput,
): Promise<void> {
  try {
    const api = getTelegramApi()
    const chatId = Number(input.telegramId)
    const message = buildSupportTicketAnsweredMessage({
      ticketCode: input.ticketCode,
      category: input.category,
      preview: input.preview,
    })

    await api.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      reply_markup: createSupportTicketKeyboard(buildTicketUrl(input.ticketCode)),
      link_preview_options: { is_disabled: true },
    })

    log.bot('support ticket answered message sent', {
      ticketCode: input.ticketCode,
      telegramId: input.telegramId.toString(),
    })
  } catch (error) {
    log.error('SUPPORT', 'failed to send ticket answered message', {
      ticketCode: input.ticketCode,
      error: error instanceof Error ? error.message : 'unknown',
    })
  }
}
