import type { Bot, Context } from 'grammy'
import { log, type LogFields } from '../../lib/logger.js'

function describeUpdate(ctx: Context): LogFields {
  const from = ctx.from
  const fields: LogFields = {
    updateId: ctx.update.update_id,
    type: ctx.update.message
      ? 'message'
      : ctx.update.callback_query
        ? 'callback_query'
        : 'other',
  }

  if (from) {
    fields.userId = from.id
    if (from.username) {
      fields.username = `@${from.username}`
    }
  }

  if (ctx.message?.text) {
    fields.text = ctx.message.text
  }

  if (ctx.callbackQuery?.data) {
    fields.data = ctx.callbackQuery.data
  }

  return fields
}

export function registerBotLogging(bot: Bot): void {
  bot.use(async (ctx, next) => {
    const fields = describeUpdate(ctx)
    log.bot('update received', fields)

    const startedAt = Date.now()

    try {
      await next()
      log.bot('update handled', {
        ...fields,
        ms: Date.now() - startedAt,
      })
    } catch (error) {
      log.error('BOT', 'update failed', {
        ...fields,
        ms: Date.now() - startedAt,
        error: error instanceof Error ? error.message : 'unknown',
      })
      throw error
    }
  })
}
