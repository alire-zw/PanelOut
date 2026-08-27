import type { TelegramState, TelegramWebApp } from './types'
import { syncTelegramChromeForPath } from '../lib/telegramTheme'

const CHROME = '#0a0a0b'

function safeCall(fn: () => void) {
  try {
    fn()
  } catch {
    // Older Telegram clients throw on unsupported methods.
  }
}

export function applyDocumentTheme() {
  document.documentElement.dataset.theme = 'dark'
  document.documentElement.classList.add('dark')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', CHROME)
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

  return {
    isTelegram: Boolean(webApp && (hasInitData || user)),
    user,
    colorScheme: 'dark',
    webApp,
  }
}

export function syncTelegramTheme(_webApp?: TelegramWebApp) {
  applyDocumentTheme()
  syncTelegramChromeForPath(window.location.pathname)
}

export function initTelegram(): TelegramState {
  const state = getTelegramState()
  applyDocumentTheme()

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
