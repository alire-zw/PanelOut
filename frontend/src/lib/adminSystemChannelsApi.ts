import { apiFetch } from './api'

export type AdminSystemChannelSlot =
  | 'admin_report'
  | 'purchase_report'
  | 'notification'

export type AdminSystemChannel = {
  slotKey: AdminSystemChannelSlot
  label: string
  hint: string
  chatId: string
  username: string
  title: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type AdminSystemChannelSlotItem = {
  slotKey: AdminSystemChannelSlot
  label: string
  hint: string
  channel: AdminSystemChannel | null
}

export async function fetchAdminSystemChannelsBot() {
  const data = await apiFetch<{ ok: boolean; username: string; deepLink: string }>(
    '/api/admin/system-channels/bot',
  )
  return { username: data.username, deepLink: data.deepLink }
}

export async function fetchAdminSystemChannels() {
  const data = await apiFetch<{ ok: boolean; items: AdminSystemChannelSlotItem[] }>(
    '/api/admin/system-channels',
  )
  return { items: data.items }
}

export async function registerAdminSystemChannel(
  slotKey: AdminSystemChannelSlot,
  link: string,
) {
  const data = await apiFetch<{ ok: boolean; channel: AdminSystemChannel }>(
    `/api/admin/system-channels/${encodeURIComponent(slotKey)}/register`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ link }),
    },
  )
  return data
}

export async function setAdminSystemChannelActive(
  slotKey: AdminSystemChannelSlot,
  isActive: boolean,
) {
  const data = await apiFetch<{ ok: boolean; channel: AdminSystemChannel }>(
    `/api/admin/system-channels/${encodeURIComponent(slotKey)}/active`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive }),
    },
  )
  return data
}

export async function deleteAdminSystemChannel(slotKey: AdminSystemChannelSlot) {
  const data = await apiFetch<{ ok: boolean }>(
    `/api/admin/system-channels/${encodeURIComponent(slotKey)}`,
    { method: 'DELETE' },
  )
  return data
}
