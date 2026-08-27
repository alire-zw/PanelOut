import { InlineKeyboard } from 'grammy'
import { env } from '../../config/env.js'

export function createStartKeyboard(): InlineKeyboard {
  return new InlineKeyboard().webApp('🛍 ورود به مینی‌اپ', env.MINI_APP_URL)
}
