import type { DbUser, DbUserRole } from '../db/types.js'
import { canAccessAdminPanel } from '../config/main-admins.js'

export interface SerializedUser {
  id: number
  telegramId: string
  username: string | null
  firstName: string | null
  lastName: string | null
  realName: string | null
  phoneNumber: string | null
  phoneVerifiedAt: string | null
  nationalId: string | null
  birthDate: string | null
  termsAcceptedAt: string | null
  shahkarMatchedAt: string | null
  kycVerifiedAt: string | null
  email: string | null
  balance: string
  clubPoints: number
  role: DbUserRole
  canAccessAdminPanel: boolean
  isPremium: boolean
  isBanned: boolean
  isActive: boolean
  languageCode: string | null
  createdAt: string
  updatedAt: string
}

export function serializeUser(user: DbUser): SerializedUser {
  return {
    id: user.id,
    telegramId: user.telegramId.toString(),
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    realName: user.realName,
    phoneNumber: user.phoneNumber,
    phoneVerifiedAt: user.phoneVerifiedAt ? user.phoneVerifiedAt.toISOString() : null,
    nationalId: user.nationalId,
    birthDate: user.birthDate ? user.birthDate.toISOString().slice(0, 10) : null,
    termsAcceptedAt: user.termsAcceptedAt ? user.termsAcceptedAt.toISOString() : null,
    shahkarMatchedAt: user.shahkarMatchedAt ? user.shahkarMatchedAt.toISOString() : null,
    kycVerifiedAt: user.kycVerifiedAt ? user.kycVerifiedAt.toISOString() : null,
    email: user.email,
    balance: user.balance.toString(),
    clubPoints: user.clubPoints ?? 0,
    role: user.role,
    canAccessAdminPanel: canAccessAdminPanel(user),
    isPremium: user.isPremium,
    isBanned: user.isBanned,
    isActive: user.isActive,
    languageCode: user.languageCode,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  }
}

export function serializeUsers(users: DbUser[]): SerializedUser[] {
  return users.map(serializeUser)
}
