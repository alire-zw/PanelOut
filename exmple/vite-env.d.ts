/// <reference types="vite/client" />

interface TelegramWebApp {
  ready: () => void
  expand: () => void
  close: () => void
  disableVerticalSwipes?: () => void
  enableVerticalSwipes?: () => void
  colorScheme: 'light' | 'dark'
  themeParams: Record<string, string>
  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void
  /** Bot API 7.10+ — also applied to Android system navigation bar. */
  setBottomBarColor?: (color: string) => void
  bottomBarColor?: string
  onEvent?: (eventType: string, callback: (event?: { req_id?: string }) => void) => void
  offEvent?: (eventType: string, callback: (event?: { req_id?: string }) => void) => void
  initData: string
  initDataUnsafe: {
    start_param?: string
    user?: {
      id: number
      first_name: string
      last_name?: string
      username?: string
      language_code?: string
      photo_url?: string
    }
  }
  MainButton: {
    show: () => void
    hide: () => void
    setText: (text: string) => void
    onClick: (cb: () => void) => void
    offClick: (cb: () => void) => void
  }
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy') => void
    selectionChanged: () => void
  }
  BackButton?: {
    show: () => void
    hide: () => void
    onClick: (cb: () => void) => void
    offClick: (cb: () => void) => void
  }
  openLink?: (url: string, options?: { try_instant_view?: boolean }) => void
  openTelegramLink?: (url: string) => void
  version?: string
  platform?: string
  isVersionAtLeast?: (version: string) => boolean
  requestChat?: (reqId: string, callback?: (success: boolean) => void) => void
}

interface Window {
  Telegram?: {
    WebApp: TelegramWebApp
  }
}
