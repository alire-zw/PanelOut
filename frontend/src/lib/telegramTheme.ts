type ColorScheme = 'light' | 'dark'

/**
 * Must match `--hub-chrome` in Admin.css.
 * Lime-tinted dark so Telegram header + admin glow share the site accent.
 */
const ADMIN_CHROME_DARK = '#0c1006'
const ADMIN_CHROME_LIGHT = '#f4ffe6'

function readAppBackground(): string {
  return getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#0a0a0b'
}

function updateMetaThemeColor(color: string) {
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color)
}

function safeCall(fn: () => void) {
  try {
    fn()
  } catch {
    // Older Telegram clients throw on unsupported methods.
  }
}

function applyTelegramChrome(color: string, scheme: ColorScheme) {
  const tg = window.Telegram?.WebApp
  if (!tg) return
  safeCall(() => tg.setHeaderColor(color))
  safeCall(() => tg.setBackgroundColor(color))
  const bottomBar = scheme === 'light' ? '#ffffff' : '#000000'
  safeCall(() => tg.setBottomBarColor?.(bottomBar))
}

export function applyAppTheme(colorScheme: ColorScheme) {
  document.documentElement.dataset.theme = colorScheme
  document.documentElement.classList.toggle('dark', colorScheme === 'dark')
  syncTelegramChromeForPath(window.location.pathname)
}

/** Keep Telegram mini-app header in sync with current route atmosphere. */
export function syncTelegramChromeForPath(pathname: string) {
  const scheme =
    (document.documentElement.dataset.theme as ColorScheme | undefined) ?? 'dark'
  const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/')

  if (isAdmin) {
    const chrome = scheme === 'light' ? ADMIN_CHROME_LIGHT : ADMIN_CHROME_DARK
    updateMetaThemeColor(chrome)
    applyTelegramChrome(chrome, scheme)
    return
  }

  const bg = readAppBackground()
  updateMetaThemeColor(bg)
  applyTelegramChrome(bg, scheme)
}
