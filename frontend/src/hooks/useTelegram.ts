import { useCallback, useEffect, useState } from 'react'
import {
  getTelegramState,
  initTelegram,
  applyDocumentTheme,
  disableTelegramClosingSwipes,
} from '../telegram/init'
import { syncTelegramChromeForPath } from '../lib/telegramTheme'
import type { TelegramHapticFeedback, TelegramState } from '../telegram/types'

type HapticStyle = Parameters<TelegramHapticFeedback['impactOccurred']>[0]

export type TelegramHook = TelegramState & {
  haptic: (style?: HapticStyle) => void
  isReady: boolean
}

export function useTelegram(): TelegramHook {
  const [state, setState] = useState<TelegramState>(() => getTelegramState())
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    let webApp: ReturnType<typeof getTelegramState>['webApp'] = null

    const sync = () => {
      const next = getTelegramState()
      if (next.webApp) {
        // Theme tokens only — route chrome is applied from App via pathname.
        applyDocumentTheme()
        disableTelegramClosingSwipes(next.webApp)
        syncTelegramChromeForPath(window.location.pathname)
      } else {
        applyDocumentTheme()
      }
      if (!cancelled) {
        setState(next)
      }
    }

    async function boot() {
      try {
        await import('@twa-dev/sdk')
      } catch {
        applyDocumentTheme()
        if (!cancelled) setIsReady(true)
        return
      }

      if (cancelled) {
        return
      }

      initTelegram()
      webApp = window.Telegram?.WebApp ?? null
      if (cancelled || !webApp) {
        sync()
        if (!cancelled) setIsReady(true)
        return
      }

      disableTelegramClosingSwipes(webApp)
      applyDocumentTheme()
      syncTelegramChromeForPath(window.location.pathname)
      sync()
      if (!cancelled) setIsReady(true)

      webApp.onEvent('themeChanged', sync)
      webApp.onEvent('viewportChanged', sync)
    }

    void boot()

    return () => {
      cancelled = true
      if (webApp) {
        webApp.offEvent('themeChanged', sync)
        webApp.offEvent('viewportChanged', sync)
      }
    }
  }, [])

  const haptic = useCallback(
    (style: HapticStyle = 'light') => {
      try {
        state.webApp?.HapticFeedback?.impactOccurred(style)
      } catch {
        // Ignore unsupported haptic APIs.
      }
    },
    [state.webApp],
  )

  return { ...state, isReady, haptic }
}
