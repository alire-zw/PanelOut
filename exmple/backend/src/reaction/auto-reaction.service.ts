import { getTelegramApi } from '../bot/client.js'
import { getBotId, getBotUsername } from '../bot/profile.js'
import { prisma } from '../db/client.js'
import type { DbUser } from '../db/types.js'
import {
  parseTelegramPostLink,
  ReactionPostPreviewError,
} from './reaction-post-preview.service.js'
import {
  parseAutoReactionItems,
  serializeAutoReactionChannel,
  type AutoReactionItem,
} from './auto-reaction.types.js'
import type { AutoReactionConfigureBody } from './reaction.schema.js'

export class AutoReactionError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'BOT_NOT_ADMIN'
      | 'USER_NOT_ADMIN'
      | 'CHANNEL_UNAVAILABLE'
      | 'INVALID_LINK'
      | 'PRIVATE_CHANNEL'
      | 'NOT_FOUND'
      | 'INVALID_REACTIONS',
  ) {
    super(message)
    this.name = 'AutoReactionError'
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
    throw new AutoReactionError('ربات در دسترس نیست', 'CHANNEL_UNAVAILABLE')
  }

  return { id: botId, username }
}

export async function getAutoReactionBotInfo() {
  const bot = await resolveBotIdentity()
  return {
    username: bot.username,
    deepLink: `https://t.me/${bot.username}?startchannel&admin=post_messages+edit_messages+delete_messages`,
  }
}

export async function listAutoReactionChannels(userId: number) {
  const channels = await prisma.autoReactionChannel.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  })

  return channels.map(serializeAutoReactionChannel)
}

export async function registerAutoReactionChannel(user: DbUser, link: string) {
  let parsed
  try {
    parsed = parseTelegramPostLink(link)
  } catch (error) {
    if (error instanceof ReactionPostPreviewError) {
      throw new AutoReactionError(
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
    throw new AutoReactionError('کانال پیدا نشد یا عمومی نیست', 'CHANNEL_UNAVAILABLE')
  }

  if (chat.type !== 'channel') {
    throw new AutoReactionError('لینک باید مربوط به یک کانال باشد', 'CHANNEL_UNAVAILABLE')
  }

  let botMember
  try {
    botMember = await api.getChatMember(chat.id, bot.id)
  } catch {
    throw new AutoReactionError(
      'ربات را به‌عنوان ادمین کانال اضافه کنید و دوباره تلاش کنید',
      'BOT_NOT_ADMIN',
    )
  }

  if (!isAdminStatus(botMember.status)) {
    throw new AutoReactionError(
      'ربات باید ادمین کانال باشد تا ری‌اکشن خودکار کار کند',
      'BOT_NOT_ADMIN',
    )
  }

  let userMember
  try {
    userMember = await api.getChatMember(chat.id, Number(user.telegramId))
  } catch {
    throw new AutoReactionError(
      'شما باید ادمین این کانال باشید',
      'USER_NOT_ADMIN',
    )
  }

  if (!isAdminStatus(userMember.status)) {
    throw new AutoReactionError(
      'فقط ادمین کانال می‌تواند ری‌اکشن خودکار را فعال کند',
      'USER_NOT_ADMIN',
    )
  }

  const username = (chat.username ?? parsed.username).toLowerCase()
  const title = chat.title?.trim() || username

  const existing = await prisma.autoReactionChannel.findUnique({
    where: {
      userId_chatId: {
        userId: user.id,
        chatId: BigInt(chat.id),
      },
    },
  })

  const channel = existing
    ? await prisma.autoReactionChannel.update({
        where: { id: existing.id },
        data: {
          username,
          title,
        },
      })
    : await prisma.autoReactionChannel.create({
        data: {
          userId: user.id,
          chatId: BigInt(chat.id),
          username,
          title,
          reactionsJson: [],
          isActive: false,
        },
      })

  return serializeAutoReactionChannel(channel)
}

export async function configureAutoReactionChannel(
  userId: number,
  channelId: number,
  input: AutoReactionConfigureBody,
) {
  const channel = await prisma.autoReactionChannel.findFirst({
    where: { id: channelId, userId },
  })

  if (!channel) {
    throw new AutoReactionError('کانال پیدا نشد', 'NOT_FOUND')
  }

  const reactions: AutoReactionItem[] = input.reactions.map((item) => ({
    serviceId: item.serviceId,
    emoji: item.emoji,
    quantity: item.quantity,
    rate: item.rate,
  }))

  if (reactions.length === 0) {
    throw new AutoReactionError('حداقل یک ری‌اکشن انتخاب کنید', 'INVALID_REACTIONS')
  }

  const updated = await prisma.autoReactionChannel.update({
    where: { id: channel.id },
    data: {
      reactionsJson: reactions,
      randomizeQuantity: input.randomizeQuantity,
      isActive: true,
    },
  })

  return serializeAutoReactionChannel(updated)
}

export async function deactivateAutoReactionChannel(userId: number, channelId: number) {
  const channel = await prisma.autoReactionChannel.findFirst({
    where: { id: channelId, userId },
  })

  if (!channel) {
    throw new AutoReactionError('کانال پیدا نشد', 'NOT_FOUND')
  }

  const updated = await prisma.autoReactionChannel.update({
    where: { id: channel.id },
    data: { isActive: false },
  })

  return serializeAutoReactionChannel(updated)
}

export async function deleteAutoReactionChannel(userId: number, channelId: number) {
  const channel = await prisma.autoReactionChannel.findFirst({
    where: { id: channelId, userId },
  })

  if (!channel) {
    throw new AutoReactionError('کانال پیدا نشد', 'NOT_FOUND')
  }

  await prisma.autoReactionChannel.delete({ where: { id: channel.id } })
  return { ok: true }
}

export async function deactivateChannelsByChatId(chatId: number | bigint) {
  await prisma.autoReactionChannel.updateMany({
    where: { chatId: BigInt(chatId) },
    data: { isActive: false },
  })
}

export { parseAutoReactionItems }
