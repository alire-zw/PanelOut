import { redis } from '../redis/client.js'

const CONTACT_PICKER_TTL_SECONDS = 5 * 60

function buildContactPickerKey(telegramUserId: number, requestId: number): string {
  return `transfer:contact-picker:${telegramUserId}:${requestId}`
}

export interface StoredTransferRecipient {
  telegramId: number
  firstName?: string
  lastName?: string
  username?: string
}

export async function saveContactPickerResult(
  telegramUserId: number,
  requestId: number,
  users: StoredTransferRecipient[],
): Promise<void> {
  const key = buildContactPickerKey(telegramUserId, requestId)
  await redis.set(key, JSON.stringify(users), 'EX', CONTACT_PICKER_TTL_SECONDS)
}

export async function getContactPickerResult(
  telegramUserId: number,
  requestId: number,
): Promise<StoredTransferRecipient[] | null> {
  const key = buildContactPickerKey(telegramUserId, requestId)
  const raw = await redis.get(key)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as StoredTransferRecipient[]
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

export async function clearContactPickerResult(
  telegramUserId: number,
  requestId: number,
): Promise<void> {
  const key = buildContactPickerKey(telegramUserId, requestId)
  await redis.del(key)
}
