import type { SupportTicketCategory } from '@prisma/client'
import { getActiveAdminSystemChannel } from '../../admin/admin-system-channels.service.js'
import { log } from '../../lib/logger.js'
import { getTelegramApi } from '../client.js'
import { getBotUsername, setBotId, setBotUsername } from '../profile.js'
import { createAdminTicketReportKeyboard } from '../keyboards/admin-ticket-report.js'
import {
  buildAdminTicketReportMessage,
  type AdminTicketReportKind,
} from '../messages/admin-ticket-report.js'

interface NotifyAdminTicketReportInput {
  kind?: AdminTicketReportKind
  ticketCode: string
  category: SupportTicketCategory
  orderId?: string | null
  user: {
    telegramId: bigint
    username?: string | null
    firstName?: string | null
    lastName?: string | null
    realName?: string | null
  }
}

async function resolveMiniAppDeepLink(): Promise<string> {
  let username = getBotUsername()
  if (!username) {
    const me = await getTelegramApi().getMe()
    username = me.username ?? ''
    if (username) {
      setBotUsername(username)
      setBotId(me.id)
    }
  }

  if (!username) {
    throw new Error('Bot username unavailable for mini-app deep link')
  }

  // Channel messages cannot use web_app buttons; t.me startapp opens the Mini App.
  return `https://t.me/${username.replace(/^@/, '')}?startapp=profile`
}

export async function notifyAdminTicketReport(
  input: NotifyAdminTicketReportInput,
): Promise<void> {
  const kind = input.kind ?? 'created'
  try {
    const channel = await getActiveAdminSystemChannel('admin_report')
    if (!channel) {
      log.bot('admin ticket report skipped — no active admin_report channel', {
        ticketCode: input.ticketCode,
        kind,
      })
      return
    }

    const api = getTelegramApi()
    const deepLink = await resolveMiniAppDeepLink()
    const message = buildAdminTicketReportMessage({
      kind,
      ticketCode: input.ticketCode,
      category: input.category,
      orderId: input.orderId,
      user: {
        telegramId: input.user.telegramId.toString(),
        username: input.user.username,
        firstName: input.user.firstName,
        lastName: input.user.lastName,
        realName: input.user.realName,
      },
    })

    await api.sendMessage(Number(channel.chatId), message, {
      parse_mode: 'HTML',
      reply_markup: createAdminTicketReportKeyboard(deepLink),
      link_preview_options: { is_disabled: true },
    })

    log.bot('admin ticket report sent', {
      ticketCode: input.ticketCode,
      kind,
      chatId: channel.chatId.toString(),
    })
  } catch (error) {
    log.error('SUPPORT', 'failed to send admin ticket report', {
      ticketCode: input.ticketCode,
      kind,
      error: error instanceof Error ? error.message : 'unknown',
    })
  }
}
