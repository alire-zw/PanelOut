import type { Context } from 'grammy'
import { log } from '../../lib/logger.js'
import { storeUsersSharedResult } from '../../transfers/contact-picker.service.js'

export async function handleUsersShared(ctx: Context): Promise<void> {
  const shared = ctx.message?.users_shared
  const from = ctx.from

  if (!shared || !from) {
    return
  }

  const users = shared.users.map((user) => ({
    telegramId: user.user_id,
    firstName: user.first_name,
    lastName: user.last_name,
    username: user.username,
  }))

  await storeUsersSharedResult({
    ownerTelegramId: from.id,
    requestId: shared.request_id,
    users,
  })

  log.bot('transfer contact picker users shared', {
    ownerTelegramId: from.id,
    requestId: shared.request_id,
    count: users.length,
  })
}
