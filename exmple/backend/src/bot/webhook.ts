import { webhookCallback, type Bot } from 'grammy'
import type { FastifyInstance } from 'fastify'
import { env, webhookUrl } from '../config/env.js'
import { setBotId, setBotUsername } from '../bot/profile.js'
import { formatError, log } from '../lib/logger.js'
import { isIgnorableTelegramDeliveryError } from './telegram-errors.js'
import { getTelegramApiRoot } from './telegram-api-access.js'

const WEBHOOK_SETUP_ATTEMPTS = 3
const WEBHOOK_RETRY_DELAY_MS = 1500
const WEBHOOK_BACKGROUND_RETRY_MS = 20_000

let backgroundRetryTimer: ReturnType<typeof setTimeout> | null = null
let webhookConfigured = false

export function registerBotWebhook(app: FastifyInstance, bot: Bot): void {
  const handler = webhookCallback(bot, 'fastify', {
    secretToken: env.TELEGRAM_BOT_SECRET,
  })

  app.post(env.WEBHOOK_PATH, {
    config: {
      rateLimit: false,
    },
    handler: async (request, reply) => {
      try {
        return await handler(request, reply)
      } catch (error) {
        // grammY bot.catch does not apply in webhook mode; swallow user-block etc.
        if (isIgnorableTelegramDeliveryError(error)) {
          log.warn('WEBHOOK', 'ignored telegram delivery error', {
            error: formatError(error),
          })
          if (!reply.sent) {
            return reply.code(200).send({ ok: true, ignored: true })
          }
          return
        }
        throw error
      }
    },
  })

  log.info('WEBHOOK', 'route registered', { path: env.WEBHOOK_PATH })
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function applyWebhook(bot: Bot): Promise<{ username: string }> {
  log.info('WEBHOOK', 'setting Telegram webhook…', {
    url: webhookUrl,
    api: getTelegramApiRoot(),
  })

  await bot.api.setWebhook(webhookUrl, {
    secret_token: env.TELEGRAM_BOT_SECRET,
    drop_pending_updates: false,
    allowed_updates: ['message', 'callback_query', 'channel_post', 'my_chat_member'],
  })

  const me = await bot.api.getMe()
  const webhookInfo = await bot.api.getWebhookInfo()

  if (me.username) {
    setBotUsername(me.username)
  }
  setBotId(me.id)

  const registeredUrl = webhookInfo.url || ''
  if (registeredUrl && registeredUrl !== webhookUrl) {
    log.warn('WEBHOOK', 'registered URL differs from expected', {
      expected: webhookUrl,
      actual: registeredUrl,
    })
  }

  if (!registeredUrl) {
    throw new Error('Telegram accepted setWebhook but getWebhookInfo returned empty url')
  }

  webhookConfigured = true
  log.info('WEBHOOK', 'configured successfully', {
    bot: me.username ? `@${me.username}` : String(me.id),
    url: registeredUrl,
    pending: webhookInfo.pending_update_count,
    lastError: webhookInfo.last_error_message ?? 'none',
  })

  return { username: me.username ?? 'unknown' }
}

export async function setupTelegramWebhook(bot: Bot): Promise<{ username: string }> {
  let lastError: unknown

  for (let attempt = 1; attempt <= WEBHOOK_SETUP_ATTEMPTS; attempt += 1) {
    try {
      return await applyWebhook(bot)
    } catch (error) {
      lastError = error
      log.warn('WEBHOOK', `setup attempt ${attempt}/${WEBHOOK_SETUP_ATTEMPTS} failed`, {
        error: formatError(error),
      })

      if (attempt < WEBHOOK_SETUP_ATTEMPTS) {
        await sleep(WEBHOOK_RETRY_DELAY_MS * attempt)
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(formatError(lastError) || 'Telegram webhook setup failed')
}

/** Keeps retrying in background until Telegram accepts the webhook. */
export function keepTryingTelegramWebhook(bot: Bot): void {
  if (webhookConfigured || backgroundRetryTimer) {
    return
  }

  const tick = async (): Promise<void> => {
    if (webhookConfigured) {
      return
    }

    try {
      await applyWebhook(bot)
      backgroundRetryTimer = null
      return
    } catch (error) {
      log.warn('WEBHOOK', 'background retry failed; will try again', {
        error: formatError(error),
        nextInMs: WEBHOOK_BACKGROUND_RETRY_MS,
      })
      backgroundRetryTimer = setTimeout(() => {
        void tick()
      }, WEBHOOK_BACKGROUND_RETRY_MS)
    }
  }

  log.info('WEBHOOK', 'background retry armed', {
    everyMs: WEBHOOK_BACKGROUND_RETRY_MS,
  })
  backgroundRetryTimer = setTimeout(() => {
    void tick()
  }, WEBHOOK_BACKGROUND_RETRY_MS)
}

export function stopWebhookRetries(): void {
  if (backgroundRetryTimer) {
    clearTimeout(backgroundRetryTimer)
    backgroundRetryTimer = null
  }
}

export async function removeTelegramWebhook(bot: Bot): Promise<void> {
  await bot.api.deleteWebhook({ drop_pending_updates: false })
  log.info('WEBHOOK', 'removed from Telegram')
}
