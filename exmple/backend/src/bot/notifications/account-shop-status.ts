import { env } from '../../config/env.js'
import { log } from '../../lib/logger.js'
import { prisma } from '../../db/client.js'
import { getTelegramApi } from '../client.js'
import { createAccountShopOrderKeyboard } from '../keyboards/account-shop-order.js'
import {
  buildAccountShopStatusChangedMessage,
  type AccountShopStatusNotify,
} from '../messages/account-shop-status.js'

function buildOrderUrl(orderId: string): string {
  const base = env.MINI_APP_URL.replace(/\/$/, '')
  return `${base}/orders/${encodeURIComponent(orderId)}`
}

export async function notifyAccountShopStatusChanged(input: {
  userId: number
  orderId: string
  status: AccountShopStatusNotify
  planName?: string | null
}): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { telegramId: true },
    })
    if (!user?.telegramId) {
      log.bot('account shop status notify skipped — no telegram id', {
        orderId: input.orderId,
        userId: input.userId,
      })
      return
    }

    const api = getTelegramApi()
    const message = buildAccountShopStatusChangedMessage({
      orderId: input.orderId,
      status: input.status,
      planName: input.planName,
    })

    await api.sendMessage(Number(user.telegramId), message, {
      parse_mode: 'HTML',
      reply_markup: createAccountShopOrderKeyboard(buildOrderUrl(input.orderId)),
      link_preview_options: { is_disabled: true },
    })

    log.bot('account shop status changed message sent', {
      orderId: input.orderId,
      userId: input.userId,
      status: input.status,
      telegramId: user.telegramId.toString(),
    })
  } catch (error) {
    log.error('ACCOUNT_SHOP', 'failed to send status change message', {
      orderId: input.orderId,
      userId: input.userId,
      error: error instanceof Error ? error.message : 'unknown',
    })
  }
}
