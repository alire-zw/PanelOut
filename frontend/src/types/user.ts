export type UserRole = 'user' | 'admin' | 'supervisor'

export type AppUser = {
  id: number
  telegramId: number
  realName: string | null
  telegramName: string | null
  username: string | null
  balance: number
  isPremium: boolean
  email: string | null
  phoneNumber: string | null
  role: UserRole
  isBanned: boolean
  createdAt: string | null
  canAccessAdminPanel: boolean
  isSupervisor?: boolean
}
