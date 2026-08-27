import { getTelegramApi } from '../bot/client.js'
import { prisma } from '../db/client.js'
import type { DbUser } from '../db/types.js'
import { isStaffRole } from '../users/user.service.js'
import {
  ADMIN_SYSTEM_CHANNEL_LABELS,
  CHANNEL_LOCK_SLOTS,
  isChannelLockSlot,
  type ChannelLockSlotKey,
} from '../admin/admin-system-channels.schema.js'

export type ChannelLockItem = {
  slotKey: ChannelLockSlotKey
  label: string
  title: string
  username: string
  url: string
  joined: boolean
}

function isMemberStatus(status: string): boolean {
  return (
    status === 'creator' ||
    status === 'administrator' ||
    status === 'member' ||
    status === 'restricted'
  )
}

async function checkUserJoinedChannel(chatId: bigint, telegramId: bigint): Promise<boolean> {
  try {
    const member = await getTelegramApi().getChatMember(Number(chatId), Number(telegramId))
    return isMemberStatus(member.status)
  } catch {
    return false
  }
}

function serializeLockChannel(
  row: {
    slotKey: ChannelLockSlotKey | string
    title: string
    username: string
  },
  joined: boolean,
): ChannelLockItem {
  const slotKey = row.slotKey as ChannelLockSlotKey
  const username = row.username.replace(/^@/, '').toLowerCase()
  return {
    slotKey,
    label: ADMIN_SYSTEM_CHANNEL_LABELS[slotKey] ?? row.title,
    title: row.title,
    username,
    url: `https://t.me/${username}`,
    joined,
  }
}

export async function listActiveSystemChannelsForLock() {
  const rows = await prisma.adminSystemChannel.findMany({
    where: {
      isActive: true,
      slotKey: { in: [...CHANNEL_LOCK_SLOTS] },
    },
    orderBy: { createdAt: 'asc' },
  })

  const order = new Map(CHANNEL_LOCK_SLOTS.map((slot, index) => [slot, index] as const))

  return [...rows].sort(
    (a, b) =>
      (order.get(a.slotKey as ChannelLockSlotKey) ?? 99) -
      (order.get(b.slotKey as ChannelLockSlotKey) ?? 99),
  )
}

export async function getChannelLockStatus(user: DbUser): Promise<{
  required: boolean
  bypassed: boolean
  channels: ChannelLockItem[]
}> {
  if (isStaffRole(user.role)) {
    return { required: false, bypassed: true, channels: [] }
  }

  const rows = await listActiveSystemChannelsForLock()
  if (rows.length === 0) {
    return { required: false, bypassed: false, channels: [] }
  }

  const channels = await Promise.all(
    rows.map(async (row) => {
      const joined = await checkUserJoinedChannel(row.chatId, user.telegramId)
      return serializeLockChannel(row, joined)
    }),
  )

  const required = channels.some((channel) => !channel.joined)
  return { required, bypassed: false, channels }
}

export async function checkChannelLockMembership(
  user: DbUser,
  slotKeyRaw: string,
): Promise<ChannelLockItem | null> {
  if (!isChannelLockSlot(slotKeyRaw)) {
    return null
  }

  const row = await prisma.adminSystemChannel.findFirst({
    where: { slotKey: slotKeyRaw, isActive: true },
  })
  if (!row) return null

  const joined = await checkUserJoinedChannel(row.chatId, user.telegramId)
  return serializeLockChannel(row, joined)
}
