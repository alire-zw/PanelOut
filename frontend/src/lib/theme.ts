import { applyAppTheme } from './telegramTheme'

export type ThemeMode = 'auto' | 'light' | 'dark'
export type ColorScheme = 'light' | 'dark'

const STORAGE_KEY = 'panelout.themeMode'

let autoThemeRefreshHandler: (() => void) | null = null

export function readThemeMode(): ThemeMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'light' || raw === 'dark' || raw === 'auto') return raw
  } catch {
    // ignore
  }
  return 'dark'
}

export function writeThemeMode(mode: ThemeMode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // ignore
  }
}

export function getSystemColorScheme(): ColorScheme {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function getTelegramColorScheme(): ColorScheme | null {
  const scheme = window.Telegram?.WebApp?.colorScheme
  return scheme === 'light' || scheme === 'dark' ? scheme : null
}

export function resolveColorScheme(mode: ThemeMode = readThemeMode()): ColorScheme {
  if (mode === 'light') return 'light'
  if (mode === 'dark') return 'dark'
  return getTelegramColorScheme() ?? getSystemColorScheme()
}

export function bootstrapTheme(mode: ThemeMode = readThemeMode()) {
  applyAppTheme(resolveColorScheme(mode))
}

export function setAutoThemeRefreshHandler(handler: (() => void) | null) {
  autoThemeRefreshHandler = handler
}

export function refreshAutoTheme() {
  if (readThemeMode() !== 'auto') return
  autoThemeRefreshHandler?.()
}
