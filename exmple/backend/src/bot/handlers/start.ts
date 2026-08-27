import type { Context } from 'grammy'
import { log } from '../../lib/logger.js'
import { findOrCreateUserFromTelegram } from '../../users/user.service.js'
import { serializeUser } from '../../users/user.serializer.js'
import { START_MESSAGE } from '../messages/start.js'
import { createStartKeyboard } from '../keyboards/start.js'

export async function handleStartCommand(ctx: Context): Promise<void> {
  const from = ctx.from

  log.bot('command /start', {
    userId: from?.id,
    username: from?.username ? `@${from.username}` : undefined,
    premium: from?.is_premium ?? false,
  })

  if (from) {
    const user = await findOrCreateUserFromTelegram({
      id: from.id,
      firstName: from.first_name,
      lastName: from.last_name,
      username: from.username,
      languageCode: from.language_code,
      isPremium: from.is_premium,
    })

    const serialized = serializeUser(user)
    log.db('user upserted', {
      id: serialized.id,
      telegramId: serialized.telegramId,
      role: serialized.role,
      balance: serialized.balance,
    })
  }

  await ctx.reply(START_MESSAGE, {
    reply_markup: createStartKeyboard(),
  })

  log.bot('reply sent', {
    chatId: ctx.chat?.id,
    userId: from?.id,
    chars: START_MESSAGE.length,
  })
}
