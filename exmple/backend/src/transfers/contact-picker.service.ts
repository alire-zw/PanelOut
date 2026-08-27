import { Keyboard } from 'grammy'
import { getTelegramApi } from '../bot/client.js'
import {
  clearContactPickerResult,
  getContactPickerResult,
  saveContactPickerResult,
  type StoredTransferRecipient,
} from './contact-picker.store.js'

function createSignedRequestId(): number {
  return Math.floor(Math.random() * 2_000_000_000) - 1_000_000_000
}

export async function createContactPickerSession(telegramUserId: number) {
  const requestId = createSignedRequestId()

  const button = Keyboard.requestUsers('انتخاب مخاطب', requestId, {
    max_quantity: 1,
    user_is_bot: false,
    request_name: true,
    request_username: true,
    request_photo: false,
  })

  try {
    const prepared = await getTelegramApi().savePreparedKeyboardButton(telegramUserId, button)

    return {
      preparedButtonId: prepared.id,
      requestId,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to prepare contact picker'
    throw new Error(message)
  }
}

export async function storeUsersSharedResult(input: {
  ownerTelegramId: number
  requestId: number
  users: StoredTransferRecipient[]
}) {
  await saveContactPickerResult(input.ownerTelegramId, input.requestId, input.users)
}

export async function readContactPickerResult(telegramUserId: number, requestId: number) {
  return getContactPickerResult(telegramUserId, requestId)
}

export async function consumeContactPickerResult(telegramUserId: number, requestId: number) {
  const users = await getContactPickerResult(telegramUserId, requestId)
  if (!users) return null

  await clearContactPickerResult(telegramUserId, requestId)
  return users
}
