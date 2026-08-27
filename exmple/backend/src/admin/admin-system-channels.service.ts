import type { AdminSystemChannel, AdminSystemChannelSlot } from '@prisma/client'
import { getTelegramApi } from '../bot/client.js'
import { getBotId, getBotUsername } from '../bot/profile.js'
import { prisma } from '../db/client.js'
import type { DbUser } from '../db/types.js'
import {
  parseTelegramPostLink,
  ReactionPostPreviewError,
} from '../reaction/reaction-post-preview.service.js'
import {
  ADMIN_SYSTEM_CHANNEL_HINTS,
  ADMIN_SYSTEM_CHANNEL_LABELS,
  ADMIN_SYSTEM_CHANNEL_SLOTS,
  isAlwaysOnSystemChannel,
  type AdminSystemChannelSlotKey,
} from './admin-system-channels.schema.js'

export class AdminSystemChannelError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'BOT_NOT_ADMIN'
      | 'USER_NOT_ADMIN'
      | 'CHANNEL_UNAVAILABLE'
      | 'INVALID_LINK'
      | 'PRIVATE_CHANNEL'
      | 'INVALID_SLOT'
      | 'NOT_FOUND',
  ) {
    super(message)
    this.name = 'AdminSystemChannelError'
  }
}

function isAdminStatus(status: string): boolean {
  return status === 'administrator' || status === 'creator'
}

function assertSlot(slotKey: string): AdminSystemChannelSlotKey {
  if (!(ADMIN_SYSTEM_CHANNEL_SLOTS as readonly string[]).includes(slotKey)) {
    throw new AdminSystemChannelError('نوع کانال نامعتبر است', 'INVALID_SLOT')
  }
  return slotKey as AdminSystemChannelSlotKey
}

function serializeChannel(row: AdminSystemChannel) {
  const slotKey = row.slotKey as AdminSystemChannelSlotKey
  return {
    slotKey,
    label: ADMIN_SYSTEM_CHANNEL_LABELS[slotKey],
    hint: ADMIN_SYSTEM_CHANNEL_HINTS[slotKey],
    chatId: row.chatId.toString(),
    username: row.username,
    title: row.title,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
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
    throw new AdminSystemChannelError('ربات در دسترس نیست', 'CHANNEL_UNAVAILABLE')
  }

  return { id: botId, username }
}

export async function getAdminSystemChannelsBotInfo() {
  const bot = await resolveBotIdentity()
  return {
    username: bot.username,
    deepLink: `https://t.me/${bot.username}?startchannel&admin=post_messages+edit_messages+delete_messages`,
  }
}

export async function listAdminSystemChannels() {
  const rows = await prisma.adminSystemChannel.findMany()
  const bySlot = new Map(rows.map((row) => [row.slotKey, row]))

  return {
    items: ADMIN_SYSTEM_CHANNEL_SLOTS.map((slotKey) => {
      const row = bySlot.get(slotKey as AdminSystemChannelSlot)
      return {
        slotKey,
        label: ADMIN_SYSTEM_CHANNEL_LABELS[slotKey],
        hint: ADMIN_SYSTEM_CHANNEL_HINTS[slotKey],
        channel: row ? serializeChannel(row) : null,
      }
    }),
  }
}

export async function registerAdminSystemChannel(
  actor: DbUser,
  slotKeyRaw: string,
  link: string,
) {
  const slotKey = assertSlot(slotKeyRaw)

  let parsed
  try {
    parsed = parseTelegramPostLink(link)
  } catch (error) {
    if (error instanceof ReactionPostPreviewError) {
      throw new AdminSystemChannelError(
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
    throw new AdminSystemChannelError('کانال پیدا نشد یا عمومی نیست', 'CHANNEL_UNAVAILABLE')
  }

  if (chat.type !== 'channel') {
    throw new AdminSystemChannelError('لینک باید مربوط به یک کانال باشد', 'CHANNEL_UNAVAILABLE')
  }

  let botMember
  try {
    botMember = await api.getChatMember(chat.id, bot.id)
  } catch {
    throw new AdminSystemChannelError(
      'ربات را به‌عنوان ادمین کانال اضافه کنید و دوباره تلاش کنید',
      'BOT_NOT_ADMIN',
    )
  }

  if (!isAdminStatus(botMember.status)) {
    throw new AdminSystemChannelError(
      'ربات باید ادمین کانال باشد',
      'BOT_NOT_ADMIN',
    )
  }

  let userMember
  try {
    userMember = await api.getChatMember(chat.id, Number(actor.telegramId))
  } catch {
    throw new AdminSystemChannelError('شما باید ادمین این کانال باشید', 'USER_NOT_ADMIN')
  }

  if (!isAdminStatus(userMember.status)) {
    throw new AdminSystemChannelError(
      'فقط ادمین کانال می‌تواند آن را ثبت کند',
      'USER_NOT_ADMIN',
    )
  }

  const username = (chat.username ?? parsed.username).toLowerCase()
  const title = chat.title?.trim() || username

  const row = await prisma.adminSystemChannel.upsert({
    where: { slotKey },
    create: {
      slotKey,
      chatId: BigInt(chat.id),
      username,
      title,
      isActive: true,
    },
    update: {
      chatId: BigInt(chat.id),
      username,
      title,
      isActive: true,
    },
  })

  return { channel: serializeChannel(row) }
}

export async function deactivateAdminSystemChannel(slotKeyRaw: string) {
  return setAdminSystemChannelActive(slotKeyRaw, false)
}

export async function setAdminSystemChannelActive(slotKeyRaw: string, isActive: boolean) {
  const slotKey = assertSlot(slotKeyRaw)
  if (isAlwaysOnSystemChannel(slotKey)) {
    throw new AdminSystemChannelError(
      'کانال گزارش ادمین همیشه فعال است و قفل ندارد',
      'INVALID_SLOT',
    )
  }

  const existing = await prisma.adminSystemChannel.findUnique({ where: { slotKey } })
  if (!existing) {
    throw new AdminSystemChannelError('کانالی برای این بخش ثبت نشده', 'NOT_FOUND')
  }

  const row = await prisma.adminSystemChannel.update({
    where: { slotKey },
    data: { isActive },
  })

  return { channel: serializeChannel(row) }
}

export async function deleteAdminSystemChannel(slotKeyRaw: string) {
  const slotKey = assertSlot(slotKeyRaw)
  const existing = await prisma.adminSystemChannel.findUnique({ where: { slotKey } })
  if (!existing) {
    throw new AdminSystemChannelError('کانالی برای این بخش ثبت نشده', 'NOT_FOUND')
  }

  await prisma.adminSystemChannel.delete({ where: { slotKey } })
  return { ok: true as const }
}

export async function deactivateAdminSystemChannelsByChatId(chatId: number | bigint) {
  await prisma.adminSystemChannel.updateMany({
    where: {
      chatId: BigInt(chatId),
      isActive: true,
      slotKey: { not: 'admin_report' },
    },
    data: { isActive: false },
  })
}

export async function getActiveAdminSystemChannel(slotKey: AdminSystemChannelSlotKey) {
  if (isAlwaysOnSystemChannel(slotKey)) {
    return prisma.adminSystemChannel.findUnique({ where: { slotKey } })
  }

  return prisma.adminSystemChannel.findFirst({
    where: { slotKey, isActive: true },
  })
}
