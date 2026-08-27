import { apiFetch } from './api'

export type ChannelLockSlot = 'purchase_report' | 'notification'

export type ChannelLockItem = {
  slotKey: ChannelLockSlot
  label: string
  title: string
  username: string
  url: string
  joined: boolean
}

export type ChannelLockStatus = {
  required: boolean
  bypassed: boolean
  channels: ChannelLockItem[]
}

export async function fetchChannelLockStatus() {
  const data = await apiFetch<{ ok: boolean } & ChannelLockStatus>(
    '/api/channel-lock/status',
  )
  return {
    required: data.required,
    bypassed: data.bypassed,
    channels: data.channels ?? [],
  }
}

export async function checkChannelLockMembership(slotKey: ChannelLockSlot) {
  const data = await apiFetch<{ ok: boolean; channel: ChannelLockItem }>(
    `/api/channel-lock/check/${encodeURIComponent(slotKey)}`,
  )
  return { channel: data.channel }
}
