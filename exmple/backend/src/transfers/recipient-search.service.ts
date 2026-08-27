import { prisma } from '../db/client.js'

export interface TransferRecipientResult {
  telegramId: number
  firstName: string | null
  lastName: string | null
  username: string | null
  phoneNumber: string | null
}

type SearchRow = {
  telegram_id: bigint
  first_name: string | null
  last_name: string | null
  username: string | null
  phone_number: string | null
}

function normalizeSearchQuery(query: string): string {
  return query.trim()
}

function normalizePhoneQuery(query: string): string {
  return query.replace(/[\s\-()]/g, '')
}

export async function searchTransferRecipients(input: {
  query: string
  excludeTelegramId: bigint
  limit?: number
}): Promise<TransferRecipientResult[]> {
  const query = normalizeSearchQuery(input.query)
  if (query.length < 2) return []

  const usernameQuery = query.replace(/^@/, '')
  const phoneQuery = normalizePhoneQuery(query)
  const likeQuery = `%${query}%`
  const likeUsername = `%${usernameQuery}%`
  const likePhone = `%${phoneQuery}%`
  const limit = input.limit ?? 20

  const rows = await prisma.$queryRaw<SearchRow[]>`
    SELECT telegram_id, first_name, last_name, username, phone_number
    FROM users
    WHERE is_active = 1
      AND is_banned = 0
      AND role = 'user'
      AND telegram_id != ${input.excludeTelegramId}
      AND (
        username LIKE ${likeUsername}
        OR first_name LIKE ${likeQuery}
        OR last_name LIKE ${likeQuery}
        OR real_name LIKE ${likeQuery}
        OR phone_number LIKE ${likePhone}
        OR phone_number LIKE ${likeQuery}
        OR CAST(telegram_id AS CHAR) LIKE ${likeQuery}
      )
    ORDER BY username ASC, id ASC
    LIMIT ${limit}
  `

  return rows.map((user) => ({
    telegramId: Number(user.telegram_id),
    firstName: user.first_name,
    lastName: user.last_name,
    username: user.username,
    phoneNumber: user.phone_number,
  }))
}
