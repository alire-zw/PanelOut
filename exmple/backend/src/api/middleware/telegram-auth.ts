import type { FastifyReply, FastifyRequest } from 'fastify'
import { env } from '../../config/env.js'
import { validateTelegramInitData } from '../../security/telegram-init-data.js'
import { readBearerToken, verifyBrowserSessionToken } from '../../auth/browser-session.js'

declare module 'fastify' {
  interface FastifyRequest {
    telegramUser?: {
      id: number
      firstName?: string
      lastName?: string
      username?: string
      languageCode?: string
      isPremium?: boolean
      photoUrl?: string
      authDate: number
    }
    browserUserId?: number
  }
}

/**
 * Accepts Telegram Mini App initData, or (when BROWSER_PUBLIC_MODE) a Bearer session.
 */
export async function telegramAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const initData = request.headers['x-telegram-init-data']

  if (typeof initData === 'string' && initData.length > 0) {
    try {
      const validated = validateTelegramInitData(initData, env.TELEGRAM_BOT_TOKEN)

      request.telegramUser = {
        id: validated.user.id,
        firstName: validated.user.first_name,
        lastName: validated.user.last_name,
        username: validated.user.username,
        languageCode: validated.user.language_code,
        isPremium: validated.user.is_premium,
        photoUrl: validated.user.photo_url,
        authDate: validated.authDate,
      }
      return
    } catch {
      reply.code(401).send({ error: 'Unauthorized', message: 'Invalid Telegram init data' })
      return
    }
  }

  if (env.BROWSER_PUBLIC_MODE) {
    const bearer = readBearerToken(request.headers.authorization)
    if (bearer) {
      const session = verifyBrowserSessionToken(bearer)
      if (session) {
        request.browserUserId = session.userId
        return
      }
      reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or expired browser session' })
      return
    }
  }

  reply.code(401).send({
    error: 'Unauthorized',
    message: env.BROWSER_PUBLIC_MODE
      ? 'Missing Telegram init data or browser session'
      : 'Missing Telegram init data',
  })
}
