import type { DbUser, DbUserRole } from '../db/types.js'
import { Prisma } from '@prisma/client'
import { prisma } from '../db/client.js'
import { ensureUserTronWallet } from '../tron/wallet.service.js'
import type { CreateUserInput, ListUsersQuery, UpdateMeInput, UpdateUserInput } from './user.schema.js'

export interface TelegramProfile {
  id: number
  firstName?: string
  lastName?: string
  username?: string
  languageCode?: string
  isPremium?: boolean
}

function mapTelegramProfile(profile: TelegramProfile) {
  return {
    telegramId: BigInt(profile.id),
    username: profile.username ?? null,
    firstName: profile.firstName ?? null,
    lastName: profile.lastName ?? null,
    languageCode: profile.languageCode ?? null,
    isPremium: profile.isPremium ?? false,
  }
}

export async function findUserById(id: number): Promise<DbUser | null> {
  return prisma.user.findUnique({ where: { id } })
}

export async function findUserByTelegramId(telegramId: bigint): Promise<DbUser | null> {
  return prisma.user.findUnique({ where: { telegramId } })
}

export async function findOrCreateUserFromTelegram(profile: TelegramProfile): Promise<DbUser> {
  const data = mapTelegramProfile(profile)
  const updateData = {
    username: data.username,
    firstName: data.firstName,
    lastName: data.lastName,
    languageCode: data.languageCode,
    isPremium: data.isPremium,
    isActive: true,
  }

  let user: DbUser
  try {
    user = await prisma.user.upsert({
      where: { telegramId: data.telegramId },
      create: data,
      update: updateData,
    })
  } catch (error) {
    // Concurrent requests can race on MySQL unique(telegram_id) during upsert create.
    if (!isPrismaUniqueError(error)) {
      throw error
    }

    user = await prisma.user.update({
      where: { telegramId: data.telegramId },
      data: updateData,
    })
  }

  await ensureUserTronWallet(user.id)
  return user
}

export async function listUsers(query: ListUsersQuery) {
  const where: Prisma.UserWhereInput = {}

  if (query.search) {
    const search = query.search
    const asDigits = /^\d+$/.test(search)
    const telegramId = asDigits ? BigInt(search) : null
    const asUserId = asDigits ? Number.parseInt(search, 10) : NaN

    where.OR = [
      { username: { contains: search } },
      { firstName: { contains: search } },
      { lastName: { contains: search } },
      { realName: { contains: search } },
      { phoneNumber: { contains: search } },
      { email: { contains: search } },
      ...(telegramId !== null ? [{ telegramId }] : []),
      ...(Number.isSafeInteger(asUserId) ? [{ id: asUserId }] : []),
    ]
  }

  if (query.role) {
    where.role = query.role
  }

  if (query.isBanned !== undefined) {
    where.isBanned = query.isBanned
  }

  if (query.isActive !== undefined) {
    where.isActive = query.isActive
  }

  if (query.hasKyc === true) {
    where.kycVerifiedAt = { not: null }
  } else if (query.hasKyc === false) {
    where.kycVerifiedAt = null
  }

  const skip = (query.page - 1) * query.limit

  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      orderBy: { id: 'desc' },
      skip,
      take: query.limit,
    }),
    prisma.user.count({ where }),
  ])

  return {
    items,
    total,
    page: query.page,
    limit: query.limit,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
  }
}

export async function createUser(input: CreateUserInput): Promise<DbUser> {
  const user = await prisma.user.create({
    data: {
      telegramId: input.telegramId,
      username: input.username,
      firstName: input.firstName,
      lastName: input.lastName,
      realName: input.realName,
      phoneNumber: input.phoneNumber,
      email: input.email,
      balance: input.balance,
      role: input.role,
      isPremium: input.isPremium,
      isBanned: input.isBanned,
      isActive: input.isActive,
      languageCode: input.languageCode,
    },
  })

  await ensureUserTronWallet(user.id)
  return user
}

export async function updateCurrentUser(userId: number, input: UpdateMeInput): Promise<DbUser> {
  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.realName !== undefined ? { realName: input.realName } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
    },
  })
}

export async function updateUserById(userId: number, input: UpdateUserInput): Promise<DbUser> {
  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.username !== undefined ? { username: input.username } : {}),
      ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
      ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
      ...(input.realName !== undefined ? { realName: input.realName } : {}),
      ...(input.phoneNumber !== undefined ? { phoneNumber: input.phoneNumber } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.balance !== undefined ? { balance: input.balance } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.isPremium !== undefined ? { isPremium: input.isPremium } : {}),
      ...(input.isBanned !== undefined ? { isBanned: input.isBanned } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.languageCode !== undefined ? { languageCode: input.languageCode } : {}),
      ...(input.kycVerified === true ? { kycVerifiedAt: new Date() } : {}),
      ...(input.kycVerified === false ? { kycVerifiedAt: null } : {}),
    },
  })
}

export async function deactivateUser(userId: number): Promise<DbUser> {
  return prisma.user.update({
    where: { id: userId },
    data: { isActive: false },
  })
}

export function isStaffRole(role: DbUserRole): boolean {
  return role === 'admin' || role === 'supervisor'
}

export function canManageUser(actor: DbUser, target: DbUser): boolean {
  if (actor.role === 'admin') {
    return true
  }

  if (actor.role === 'supervisor') {
    return target.role === 'user'
  }

  return actor.id === target.id
}

export function isPrismaUniqueError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}
