import { Api } from 'grammy'
import { env } from '../config/env.js'

let telegramApi: Api | null = null

export function getTelegramApi(): Api {
  if (!telegramApi) {
    telegramApi = new Api(env.TELEGRAM_BOT_TOKEN)
  }

  return telegramApi
}
