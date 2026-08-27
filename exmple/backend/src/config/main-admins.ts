import { env } from './env.js'
import type { DbUserRole } from '../db/types.js'

const mainAdminTelegramIds = new Set(env.MAIN_ADMIN_TELEGRAM_IDS)

export function isMainAdminTelegramId(telegramId: bigint | number | string): boolean {
  const normalized =
    typeof telegramId === 'bigint' ? telegramId.toString() : String(telegramId).trim()

  return mainAdminTelegramIds.has(normalized)
}

export function getMainAdminTelegramIds(): readonly string[] {
  return env.MAIN_ADMIN_TELEGRAM_IDS
}

/** Main admin Telegram ID + DB role admin|supervisor. */
export function canAccessAdminPanel(user: {
  telegramId: bigint | number | string
  role: DbUserRole
}): boolean {
  return (
    isMainAdminTelegramId(user.telegramId) &&
    (user.role === 'admin' || user.role === 'supervisor')
  )
}
