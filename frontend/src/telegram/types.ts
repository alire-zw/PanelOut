export type TelegramColorScheme = 'light' | 'dark'

export type TelegramUser = {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  is_premium?: boolean
  photo_url?: string
}

export type TelegramThemeParams = {
  bg_color?: string
  text_color?: string
  hint_color?: string
  link_color?: string
  button_color?: string
  button_text_color?: string
  secondary_bg_color?: string
  header_bg_color?: string
  accent_text_color?: string
  section_bg_color?: string
  section_header_text_color?: string
  subtitle_text_color?: string
  destructive_text_color?: string
}

export type TelegramHapticFeedback = {
  impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
  notificationOccurred: (type: 'error' | 'success' | 'warning') => void
  selectionChanged: () => void
}

export type TelegramWebApp = {
  ready: () => void
  expand: () => void
  close: () => void
  colorScheme: TelegramColorScheme
  themeParams: TelegramThemeParams
  initData: string
  initDataUnsafe: {
    user?: TelegramUser
    start_param?: string
  }
  viewportHeight: number
  viewportStableHeight: number
  headerColor: string
  backgroundColor: string
  setHeaderColor: (color: string) => void
  setBackgroundColor: (color: string) => void
  setBottomBarColor?: (color: string) => void
  disableVerticalSwipes?: () => void
  enableClosingConfirmation?: () => void
  HapticFeedback?: TelegramHapticFeedback
  openTelegramLink?: (url: string) => void
  openLink?: (url: string, options?: { try_instant_view?: boolean }) => void
  BackButton?: {
    show: () => void
    hide: () => void
    onClick: (callback: () => void) => void
    offClick: (callback: () => void) => void
  }
  onEvent: (event: string, callback: () => void) => void
  offEvent: (event: string, callback: () => void) => void
  safeAreaInset?: { top: number; bottom: number; left: number; right: number }
  contentSafeAreaInset?: { top: number; bottom: number; left: number; right: number }
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp
    }
  }
}

export type TelegramState = {
  isTelegram: boolean
  user: TelegramUser | null
  colorScheme: TelegramColorScheme
  webApp: TelegramWebApp | null
}
