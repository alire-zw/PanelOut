import { log } from '../lib/logger.js'
import { prisma } from '../db/client.js'
import { invalidateWalletTransactionsCache } from '../wallet/wallet-transaction.service.js'
import { createChannelViewsOrder } from '../orders/order.service.js'
import { getPowerTelServicesMap } from '../reaction/reaction-pricing.js'
import { fulfillChannelViewsOrder } from './channel-views-purchase.fulfillment.js'
import {
  applyChannelViewsRandomize,
  calcChannelViewsToman,
  CHANNEL_VIEW_SERVICE_ID,
} from './channel-views.pricing.js'
import { applyProductPricing } from '../pricing/product-pricing.apply.js'

function buildPostLink(username: string, messageId: number): string {
  return `https://t.me/${username.replace(/^@/, '')}/${messageId}`
}

export async function processChannelPostAutoViews(input: {
  chatId: number
  messageId: number
  username?: string | null
  title?: string | null
}): Promise<void> {
  const channels = await prisma.autoChannelViewChannel.findMany({
    where: {
      chatId: BigInt(input.chatId),
      isActive: true,
    },
    include: { user: true },
  })

  if (channels.length === 0) {
    return
  }

  for (const channel of channels) {
    if (channel.serviceId !== CHANNEL_VIEW_SERVICE_ID || channel.quantity <= 0) {
      continue
    }

    const username = (input.username || channel.username).replace(/^@/, '').toLowerCase()
    if (!username) {
      log.warn('AUTO_CHANNEL_VIEWS', 'channel missing username', {
        channelId: channel.id,
        chatId: input.chatId,
      })
      continue
    }

    const existing = await prisma.autoChannelViewProcessedPost.findUnique({
      where: {
        channelId_messageId: {
          channelId: channel.id,
          messageId: input.messageId,
        },
      },
    })

    if (existing) {
      continue
    }

    const claimed = await prisma.autoChannelViewProcessedPost
      .create({
        data: {
          channelId: channel.id,
          messageId: input.messageId,
          status: 'processing',
        },
      })
      .catch(() => null)

    if (!claimed) {
      continue
    }

    try {
      if (channel.user.isBanned || !channel.user.isActive) {
        await prisma.autoChannelViewProcessedPost.update({
          where: { id: claimed.id },
          data: { status: 'skipped_user' },
        })
        continue
      }

      const { byId } = await getPowerTelServicesMap()
      const service = byId.get(CHANNEL_VIEW_SERVICE_ID)
      if (!service) {
        throw new Error('channel view service unavailable')
      }

      let qty = channel.quantity
      if (channel.randomizeQuantity) {
        qty = applyChannelViewsRandomize(channel.quantity)
      }

      qty = Math.min(Math.max(qty, service.min), service.max)
      const baseToman = calcChannelViewsToman(qty, service.rate)
      const toman = await applyProductPricing('channel-views', baseToman)

      if (qty <= 0 || toman <= 0) {
        await prisma.autoChannelViewProcessedPost.update({
          where: { id: claimed.id },
          data: { status: 'skipped_empty' },
        })
        continue
      }

      const amount = BigInt(toman)
      if (channel.user.balance < amount) {
        await prisma.autoChannelViewProcessedPost.update({
          where: { id: claimed.id },
          data: { status: 'insufficient_balance' },
        })
        log.warn('AUTO_CHANNEL_VIEWS', 'insufficient balance', {
          userId: channel.userId,
          channelId: channel.id,
          messageId: input.messageId,
          toman,
        })
        continue
      }

      const postLink = buildPostLink(username, input.messageId)
      const title = (input.title || channel.title || username).slice(0, 128)

      const order = await createChannelViewsOrder({
        userId: channel.userId,
        paymentMethod: 'wallet',
        amountToman: toman,
        quantity: qty,
        rate: service.rate,
        serviceId: CHANNEL_VIEW_SERVICE_ID,
        post: {
          username,
          messageId: input.messageId,
          link: postLink,
          title,
          preview: 'پست جدید کانال',
          photo: channel.photoUrl ?? '',
        },
      })

      await prisma.$transaction(async (tx) => {
        const current = await tx.user.findUnique({ where: { id: channel.userId } })
        if (!current || current.balance < amount) {
          throw new Error('INSUFFICIENT_BALANCE')
        }

        await tx.user.update({
          where: { id: channel.userId },
          data: { balance: { decrement: amount } },
        })
      })

      try {
        await fulfillChannelViewsOrder(order.orderId)
      } catch (error) {
        await prisma.user.update({
          where: { id: channel.userId },
          data: { balance: { increment: amount } },
        })
        throw error
      }

      void invalidateWalletTransactionsCache(channel.userId)

      await prisma.autoChannelViewProcessedPost.update({
        where: { id: claimed.id },
        data: {
          status: 'completed',
          orderId: order.orderId,
        },
      })

      if (username !== channel.username || (input.title && input.title !== channel.title)) {
        await prisma.autoChannelViewChannel.update({
          where: { id: channel.id },
          data: {
            username,
            ...(input.title ? { title: input.title.slice(0, 255) } : {}),
          },
        })
      }

      log.info('AUTO_CHANNEL_VIEWS', 'post fulfilled', {
        userId: channel.userId,
        channelId: channel.id,
        orderId: order.orderId,
        messageId: input.messageId,
        quantity: qty,
        toman,
      })
    } catch (error) {
      await prisma.autoChannelViewProcessedPost
        .update({
          where: { id: claimed.id },
          data: { status: 'failed' },
        })
        .catch(() => undefined)

      log.error('AUTO_CHANNEL_VIEWS', 'post processing failed', {
        channelId: channel.id,
        messageId: input.messageId,
        error: error instanceof Error ? error.message : 'unknown',
      })
    }
  }
}
