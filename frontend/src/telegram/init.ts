import type { TelegramState, TelegramWebApp } from './types'
import { bootstrapTheme } from '../lib/theme'
import { syncTelegramChromeForPath } from '../lib/telegramTheme'

function safeCall(fn: () => void) {
  try {
    fn()
  } catch {
    // Older Telegram clients throw on unsupported methods.
  }
}

export function applyDocumentTheme() {
  bootstrapTheme()
}

/** Keep pull-down inside the Mini App (same behavior as admin scroll pages). */
export function disableTelegramClosingSwipes(webApp?: TelegramWebApp | null) {
  const app = webApp ?? window.Telegram?.WebApp ?? null
  if (!app) return
  safeCall(() => app.disableVerticalSwipes?.())
}

export function getTelegramState(): TelegramState {
  const webApp = window.Telegram?.WebApp ?? null
  const hasInitData = Boolean(webApp?.initData)
  const user = webApp?.initDataUnsafe?.user ?? null
  const colorScheme =
    webApp?.colorScheme === 'light' || webApp?.colorScheme === 'dark'
      ? webApp.colorScheme
      : 'dark'

  return {
    isTelegram: Boolean(webApp && (hasInitData || user)),
    user,
    colorScheme,
    webApp,
  }
}

export function syncTelegramTheme(_webApp?: TelegramWebApp) {
  bootstrapTheme()
  syncTelegramChromeForPath(window.location.pathname)
}

export function initTelegram(): TelegramState {
  const state = getTelegramState()
  bootstrapTheme()

  const webApp = state.webApp
  if (!webApp) {
    return state
  }

  safeCall(() => webApp.ready())
  safeCall(() => webApp.expand())
  disableTelegramClosingSwipes(webApp)
  syncTelegramTheme(webApp)

  return state
}
