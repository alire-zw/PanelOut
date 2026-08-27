import { ACCOUNT_SHOP_CATEGORIES } from '../../chatgpt/account-shop.catalog.js'
import { getActiveAdminSystemChannel } from '../../admin/admin-system-channels.service.js'
import { prisma } from '../../db/client.js'
import { log } from '../../lib/logger.js'
import { getTelegramApi } from '../client.js'
import { getBotUsername, setBotId, setBotUsername } from '../profile.js'
import { createAdminTicketReportKeyboard } from '../keyboards/admin-ticket-report.js'
import {
  buildAdminChannelOrderMessage,
  buildPurchaseChannelOrderMessage,
  formatOrderReportTime,
  orderProductLabel,
  type OrderReportPayload,
} from '../messages/order-report.js'

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

  return `https://t.me/${username.replace(/^@/, '')}?startapp=profile`
}

function buildQuantityLabel(order: {
  slug: string
  quantity: number | null
  recipientName: string | null
  reactionTotal: number | null
  viewsQty: number | null
  membersQty: number | null
  accountPlanName: string | null
  accountDurationLabel: string | null
}): string {
  switch (order.slug) {
    case 'telegram-stars':
      return `${order.quantity ?? 0} Stars`
    case 'telegram-premium':
      return `${order.quantity ?? 0} Month`
    case 'virtual-number':
      return order.recipientName?.trim() || '1 Number'
    case 'reaction':
      return `${order.reactionTotal ?? order.quantity ?? 0} Reaction`
    case 'channel-views':
      return `${order.viewsQty ?? order.quantity ?? 0} Views`
    case 'telegram-members':
      return `${order.membersQty ?? order.quantity ?? 0} Members`
    case 'chatgpt': {
      const plan = order.accountPlanName?.trim()
      const duration = order.accountDurationLabel?.trim()
      if (plan && duration) return `${plan} · ${duration}`
      if (plan) return plan
      return '1 Account'
    }
    default:
      return order.quantity != null ? String(order.quantity) : '—'
  }
}

function buildProductLabel(order: {
  slug: string
  accountCategoryId: string | null
  accountPlanName: string | null
}): string {
  if (order.slug === 'chatgpt') {
    const category = ACCOUNT_SHOP_CATEGORIES.find((item) => item.id === order.accountCategoryId)
    const plan = order.accountPlanName?.trim()
    if (category && plan && plan !== category.labelFa) {
      return `${category.labelFa} · ${plan}`
    }
    if (plan) return plan
    if (category) return category.labelFa
  }
  return orderProductLabel(order.slug)
}

async function loadOrderReportPayload(orderId: string): Promise<OrderReportPayload | null> {
  const order = await prisma.order.findUnique({
    where: { orderId },
    include: {
      category: true,
      user: {
        select: {
          telegramId: true,
          username: true,
          firstName: true,
          lastName: true,
          realName: true,
          phoneNumber: true,
        },
      },
      reactionOrder: true,
      channelViewOrder: true,
      telegramMemberOrder: true,
      accountShopOrder: true,
    },
  })

  if (!order || !order.user) return null

  return {
    orderId: order.orderId,
    slug: order.category.slug,
    productLabel: buildProductLabel({
      slug: order.category.slug,
      accountCategoryId: order.accountShopOrder?.accountCategoryId ?? null,
      accountPlanName: order.accountShopOrder?.planName ?? null,
    }),
    quantityLabel: buildQuantityLabel({
      slug: order.category.slug,
      quantity: order.quantity,
      recipientName: order.recipientName,
      reactionTotal: order.quantity,
      viewsQty: order.channelViewOrder?.quantity ?? null,
      membersQty: order.telegramMemberOrder?.quantity ?? null,
      accountPlanName: order.accountShopOrder?.planName ?? null,
      accountDurationLabel: order.accountShopOrder?.durationLabel ?? null,
    }),
    priceToman: Number(order.amountToman),
    fulfilledAt: order.fulfilledAt ?? order.updatedAt ?? order.createdAt,
    user: {
      telegramId: order.user.telegramId.toString(),
      username: order.user.username,
      firstName: order.user.firstName,
      lastName: order.user.lastName,
      realName: order.user.realName,
      phoneNumber: order.user.phoneNumber,
    },
  }
}

async function sendToChannel(
  slotKey: 'admin_report' | 'purchase_report',
  text: string,
  deepLink: string,
): Promise<void> {
  const channel = await getActiveAdminSystemChannel(slotKey)
  if (!channel) {
    log.bot('order report skipped — channel missing or inactive', { slotKey })
    return
  }

  await getTelegramApi().sendMessage(Number(channel.chatId), text, {
    parse_mode: 'HTML',
    reply_markup: createAdminTicketReportKeyboard(deepLink),
    link_preview_options: { is_disabled: true },
  })
}

/** Fire-and-forget after an order first becomes completed. */
export async function notifyOrderCompleted(orderId: string): Promise<void> {
  try {
    const payload = await loadOrderReportPayload(orderId)
    if (!payload) {
      log.bot('order report skipped — order not found', { orderId })
      return
    }

    const timeLabel = formatOrderReportTime(payload.fulfilledAt)
    const deepLink = await resolveMiniAppDeepLink()
    const withTime = { ...payload, timeLabel }

    await Promise.allSettled([
      sendToChannel('purchase_report', buildPurchaseChannelOrderMessage(withTime), deepLink),
      sendToChannel('admin_report', buildAdminChannelOrderMessage(withTime), deepLink),
    ])

    log.bot('order report sent', {
      orderId: payload.orderId,
      slug: payload.slug,
    })
  } catch (error) {
    log.error('ORDERS', 'failed to send order report', {
      orderId,
      error: error instanceof Error ? error.message : 'unknown',
    })
  }
}
