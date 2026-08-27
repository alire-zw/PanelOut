import { Bot } from 'grammy'
import { env } from '../config/env.js'
import { formatError, log } from '../lib/logger.js'
import { handleChannelPost, handleMyChatMember } from './handlers/channel-post.js'
import { handleStartCommand } from './handlers/start.js'
import { handleUsersShared } from './handlers/users-shared.js'
import { registerBotLogging } from './middleware/logging.js'
import { getTelegramApiRoot } from './telegram-api-access.js'

export function createBot(): Bot {
  const apiRoot = getTelegramApiRoot()

  const bot = new Bot(env.TELEGRAM_BOT_TOKEN, {
    client: {
      apiRoot,
    },
  })

  log.info('BOT', 'created', { api: apiRoot })

  registerBotLogging(bot)

  bot.command('start', handleStartCommand)
  bot.on('message:users_shared', handleUsersShared)
  bot.on('channel_post', handleChannelPost)
  bot.on('my_chat_member', handleMyChatMember)

  bot.catch(({ error, ctx }) => {
    log.error('BOT', formatError(error), {
      updateId: ctx.update.update_id,
      userId: ctx.from?.id,
      username: ctx.from?.username ? `@${ctx.from.username}` : undefined,
    })
  })

  return bot
}
