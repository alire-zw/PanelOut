import { getTelegramApi } from '../bot/client.js'
import { getBotId, getBotUsername } from '../bot/profile.js'
import { prisma } from '../db/client.js'
import type { DbUser } from '../db/types.js'
import {
  parseTelegramPostLink,
  ReactionPostPreviewError,
} from '../reaction/reaction-post-preview.service.js'
import { CHANNEL_VIEW_SERVICE_ID } from './channel-views.pricing.js'
import { serializeAutoChannelViewChannel } from './auto-channel-views.types.js'
import type { AutoChannelViewsConfigureBody } from './auto-channel-views.schema.js'

export class AutoChannelViewsError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'BOT_NOT_ADMIN'
      | 'USER_NOT_ADMIN'
      | 'CHANNEL_UNAVAILABLE'
      | 'INVALID_LINK'
      | 'PRIVATE_CHANNEL'
      | 'NOT_FOUND'
      | 'INVALID_QUANTITY'
      | 'INVALID_SERVICE',
  ) {
    super(message)
    this.name = 'AutoChannelViewsError'
  }
}

function isAdminStatus(status: string): boolean {
  return status === 'administrator' || status === 'creator'
}

async function resolveBotIdentity(): Promise<{ id: number; username: string }> {
  const api = getTelegramApi()
  let botId = getBotId()
  let username = getBotUsername()

  if (!botId || !username) {
    const me = await api.getMe()
    botId = me.id
    username = me.username ?? ''
  }

  if (!botId || !username) {
    throw new AutoChannelViewsError('ربات در دسترس نیست', 'CHANNEL_UNAVAILABLE')
  }

  return { id: botId, username }
}

export async function getAutoChannelViewsBotInfo() {
  const bot = await resolveBotIdentity()
  return {
    username: bot.username,
    deepLink: `https://t.me/${bot.username}?startchannel&admin=post_messages+edit_messages+delete_messages`,
  }
}

export async function listAutoChannelViewChannels(userId: number) {
  const channels = await prisma.autoChannelViewChannel.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  })

  return channels.map(serializeAutoChannelViewChannel)
}

export async function registerAutoChannelViewChannel(user: DbUser, link: string) {
  let parsed
  try {
    parsed = parseTelegramPostLink(link)
  } catch (error) {
    if (error instanceof ReactionPostPreviewError) {
      throw new AutoChannelViewsError(
        error.message,
        error.code === 'PRIVATE_POST' ? 'PRIVATE_CHANNEL' : 'INVALID_LINK',
      )
    }
    throw error
  }

  const api = getTelegramApi()
  const bot = await resolveBotIdentity()
  const chatId = `@${parsed.username}`

  let chat
  try {
    chat = await api.getChat(chatId)
  } catch {
    throw new AutoChannelViewsError('کانال پیدا نشد یا عمومی نیست', 'CHANNEL_UNAVAILABLE')
  }

  if (chat.type !== 'channel') {
    throw new AutoChannelViewsError('لینک باید مربوط به یک کانال باشد', 'CHANNEL_UNAVAILABLE')
  }

  let botMember
  try {
    botMember = await api.getChatMember(chat.id, bot.id)
  } catch {
    throw new AutoChannelViewsError(
      'ربات را به‌عنوان ادمین کانال اضافه کنید و دوباره تلاش کنید',
      'BOT_NOT_ADMIN',
    )
  }

  if (!isAdminStatus(botMember.status)) {
    throw new AutoChannelViewsError(
      'ربات باید ادمین کانال باشد تا سین خودکار کار کند',
      'BOT_NOT_ADMIN',
    )
  }

  let userMember
  try {
    userMember = await api.getChatMember(chat.id, Number(user.telegramId))
  } catch {
    throw new AutoChannelViewsError('شما باید ادمین این کانال باشید', 'USER_NOT_ADMIN')
  }

  if (!isAdminStatus(userMember.status)) {
    throw new AutoChannelViewsError(
      'فقط ادمین کانال می‌تواند سین خودکار را فعال کند',
      'USER_NOT_ADMIN',
    )
  }

  const username = (chat.username ?? parsed.username).toLowerCase()
  const title = chat.title?.trim() || username

  const existing = await prisma.autoChannelViewChannel.findUnique({
    where: {
      userId_chatId: {
        userId: user.id,
        chatId: BigInt(chat.id),
      },
    },
  })

  const channel = existing
    ? await prisma.autoChannelViewChannel.update({
        where: { id: existing.id },
        data: {
          username,
          title,
        },
      })
    : await prisma.autoChannelViewChannel.create({
        data: {
          userId: user.id,
          chatId: BigInt(chat.id),
          username,
          title,
          serviceId: CHANNEL_VIEW_SERVICE_ID,
          quantity: 0,
          rate: 0,
          isActive: false,
        },
      })

  return serializeAutoChannelViewChannel(channel)
}

export async function configureAutoChannelViewChannel(
  userId: number,
  channelId: number,
  input: AutoChannelViewsConfigureBody,
) {
  if (input.serviceId !== CHANNEL_VIEW_SERVICE_ID) {
    throw new AutoChannelViewsError('سرویس بازدید نامعتبر است', 'INVALID_SERVICE')
  }

  const channel = await prisma.autoChannelViewChannel.findFirst({
    where: { id: channelId, userId },
  })

  if (!channel) {
    throw new AutoChannelViewsError('کانال پیدا نشد', 'NOT_FOUND')
  }

  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new AutoChannelViewsError('تعداد بازدید معتبر نیست', 'INVALID_QUANTITY')
  }

  const updated = await prisma.autoChannelViewChannel.update({
    where: { id: channel.id },
    data: {
      serviceId: CHANNEL_VIEW_SERVICE_ID,
      quantity: input.quantity,
      rate: Math.round(input.rate),
      randomizeQuantity: input.randomizeQuantity,
      isActive: true,
    },
  })

  return serializeAutoChannelViewChannel(updated)
}

export async function deactivateAutoChannelViewChannel(userId: number, channelId: number) {
  const channel = await prisma.autoChannelViewChannel.findFirst({
    where: { id: channelId, userId },
  })

  if (!channel) {
    throw new AutoChannelViewsError('کانال پیدا نشد', 'NOT_FOUND')
  }

  const updated = await prisma.autoChannelViewChannel.update({
    where: { id: channel.id },
    data: { isActive: false },
  })

  return serializeAutoChannelViewChannel(updated)
}

export async function deleteAutoChannelViewChannel(userId: number, channelId: number) {
  const channel = await prisma.autoChannelViewChannel.findFirst({
    where: { id: channelId, userId },
  })

  if (!channel) {
    throw new AutoChannelViewsError('کانال پیدا نشد', 'NOT_FOUND')
  }

  await prisma.autoChannelViewChannel.delete({ where: { id: channel.id } })
  return { ok: true }
}

export async function deactivateAutoChannelViewChannelsByChatId(chatId: number | bigint) {
  await prisma.autoChannelViewChannel.updateMany({
    where: { chatId: BigInt(chatId) },
    data: { isActive: false },
  })
}
