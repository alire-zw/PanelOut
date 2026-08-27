import { z } from 'zod'

export const ADMIN_SYSTEM_CHANNEL_SLOTS = [
  'admin_report',
  'purchase_report',
  'notification',
] as const

export type AdminSystemChannelSlotKey = (typeof ADMIN_SYSTEM_CHANNEL_SLOTS)[number]

/** کانال‌هایی که برای عضویت اجباری کاربر در مینی‌اپ استفاده می‌شوند */
export const CHANNEL_LOCK_SLOTS = ['purchase_report', 'notification'] as const

export type ChannelLockSlotKey = (typeof CHANNEL_LOCK_SLOTS)[number]

export function isChannelLockSlot(slotKey: string): slotKey is ChannelLockSlotKey {
  return (CHANNEL_LOCK_SLOTS as readonly string[]).includes(slotKey)
}

/** گزارش ادمین همیشه فعال است و قفل عضویت ندارد */
export function isAlwaysOnSystemChannel(slotKey: string): boolean {
  return slotKey === 'admin_report'
}

export const ADMIN_SYSTEM_CHANNEL_LABELS: Record<AdminSystemChannelSlotKey, string> = {
  admin_report: 'کانال گزارش ادمین',
  purchase_report: 'کانال گزارشات خرید',
  notification: 'کانال اطلاع‌رسانی',
}

export const ADMIN_SYSTEM_CHANNEL_HINTS: Record<AdminSystemChannelSlotKey, string> = {
  admin_report: 'فقط برای ادمین‌ها؛ همیشه فعال و بدون قفل عضویت',
  purchase_report: 'اطلاع خریدها و سفارش‌های موفق',
  notification: 'اطلاع‌رسانی عمومی به کاربران',
}

export const adminSystemChannelSlotSchema = z.enum(ADMIN_SYSTEM_CHANNEL_SLOTS)

export const registerAdminSystemChannelSchema = z.object({
  link: z.string().trim().min(8).max(512),
})

export type RegisterAdminSystemChannelInput = z.infer<typeof registerAdminSystemChannelSchema>

export const setAdminSystemChannelActiveSchema = z.object({
  isActive: z.boolean(),
})

export type SetAdminSystemChannelActiveInput = z.infer<typeof setAdminSystemChannelActiveSchema>
