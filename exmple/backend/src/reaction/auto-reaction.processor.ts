import { log } from '../lib/logger.js'
import { prisma } from '../db/client.js'
import { invalidateWalletTransactionsCache } from '../wallet/wallet-transaction.service.js'
import {
  createReactionOrder,
  type ReactionOrderItemRecord,
} from '../orders/order.service.js'
import { fulfillReactionOrder } from './reaction-purchase.fulfillment.js'
import {
  calcReactionItemToman,
  getPowerTelServicesMap,
} from './reaction-pricing.js'
import { applyProductPricing } from '../pricing/product-pricing.apply.js'
import { parseAutoReactionItems } from './auto-reaction.types.js'

function buildPostLink(username: string, messageId: number): string {
  return `https://t.me/${username.replace(/^@/, '')}/${messageId}`
}

export async function processChannelPostAutoReactions(input: {
  chatId: number
  messageId: number
  username?: string | null
  title?: string | null
}): Promise<void> {
  const channels = await prisma.autoReactionChannel.findMany({
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
    const reactions = parseAutoReactionItems(channel.reactionsJson)
    if (reactions.length === 0) {
      continue
    }

    const username = (input.username || channel.username).replace(/^@/, '').toLowerCase()
    if (!username) {
      log.warn('AUTO_REACTION', 'channel missing username', {
        channelId: channel.id,
        chatId: input.chatId,
      })
      continue
    }

    const existing = await prisma.autoReactionProcessedPost.findUnique({
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

    const claimed = await prisma.autoReactionProcessedPost.create({
      data: {
        channelId: channel.id,
        messageId: input.messageId,
        status: 'processing',
      },
    }).catch(() => null)

    if (!claimed) {
      continue
    }

    try {
      if (channel.user.isBanned || !channel.user.isActive) {
        await prisma.autoReactionProcessedPost.update({
          where: { id: claimed.id },
          data: { status: 'skipped_user' },
        })
        continue
      }

      const { byId } = await getPowerTelServicesMap()
      const items: ReactionOrderItemRecord[] = []
      let baseToman = 0
      let quantity = 0

      for (const reaction of reactions) {
        const service = byId.get(reaction.serviceId)
        if (!service) {
          throw new Error(`service ${reaction.serviceId} unavailable`)
        }

        let qty = reaction.quantity
        if (channel.randomizeQuantity) {
          const delta = Math.floor(Math.random() * 11) - 5 // -5 .. +5
          qty = reaction.quantity + delta
        }

        qty = Math.min(Math.max(qty, service.min), service.max)

        const itemToman = calcReactionItemToman(qty, service.rate)
        baseToman += itemToman
        quantity += qty
        items.push({
          serviceId: reaction.serviceId,
          emoji: reaction.emoji,
          quantity: qty,
          rate: service.rate,
          toman: itemToman,
        })
      }

      const toman = await applyProductPricing('reaction', baseToman)

      if (items.length === 0 || toman <= 0) {
        await prisma.autoReactionProcessedPost.update({
          where: { id: claimed.id },
          data: { status: 'skipped_empty' },
        })
        continue
      }

      const amount = BigInt(toman)
      if (channel.user.balance < amount) {
        await prisma.autoReactionProcessedPost.update({
          where: { id: claimed.id },
          data: { status: 'insufficient_balance' },
        })
        log.warn('AUTO_REACTION', 'insufficient balance', {
          userId: channel.userId,
          channelId: channel.id,
          messageId: input.messageId,
          toman,
        })
        continue
      }

      const postLink = buildPostLink(username, input.messageId)
      const title = (input.title || channel.title || username).slice(0, 128)

      const order = await createReactionOrder({
        userId: channel.userId,
        paymentMethod: 'wallet',
        amountToman: toman,
        quantity,
        post: {
          username,
          messageId: input.messageId,
          link: postLink,
          title,
          preview: 'پست جدید کانال',
          photo: channel.photoUrl ?? '',
        },
        items,
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
        await fulfillReactionOrder(order.orderId)
      } catch (error) {
        await prisma.user.update({
          where: { id: channel.userId },
          data: { balance: { increment: amount } },
        })
        throw error
      }

      void invalidateWalletTransactionsCache(channel.userId)

      await prisma.autoReactionProcessedPost.update({
        where: { id: claimed.id },
        data: {
          status: 'completed',
          orderId: order.orderId,
        },
      })

      if (username !== channel.username || (input.title && input.title !== channel.title)) {
        await prisma.autoReactionChannel.update({
          where: { id: channel.id },
          data: {
            username,
            ...(input.title ? { title: input.title.slice(0, 255) } : {}),
          },
        })
      }

      log.info('AUTO_REACTION', 'post fulfilled', {
        userId: channel.userId,
        channelId: channel.id,
        orderId: order.orderId,
        messageId: input.messageId,
        toman,
      })
    } catch (error) {
      await prisma.autoReactionProcessedPost.update({
        where: { id: claimed.id },
        data: { status: 'failed' },
      }).catch(() => undefined)

      log.error('AUTO_REACTION', 'post processing failed', {
        channelId: channel.id,
        messageId: input.messageId,
        error: error instanceof Error ? error.message : 'unknown',
      })
    }
  }
}
