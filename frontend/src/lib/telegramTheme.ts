type ColorScheme = 'light' | 'dark'

function readAppBackground(): string {
  return getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#0c0c0e'
}

function readAdminChrome(): string {
  return (
    getComputedStyle(document.documentElement).getPropertyValue('--hub-chrome').trim() ||
    '#0c1006'
  )
}

function readChromeBottom(): string {
  return (
    getComputedStyle(document.documentElement).getPropertyValue('--chrome-bottom').trim() ||
    '#000000'
  )
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

function applyTelegramChrome(color: string, _scheme?: ColorScheme) {
  const tg = window.Telegram?.WebApp
  if (!tg) return
  safeCall(() => tg.setHeaderColor(color))
  safeCall(() => tg.setBackgroundColor(color))
  safeCall(() => tg.setBottomBarColor?.(readChromeBottom()))
}

export function applyAppTheme(colorScheme: ColorScheme) {
  document.documentElement.dataset.theme = colorScheme
  document.documentElement.classList.toggle('dark', colorScheme === 'dark')
  document.documentElement.classList.toggle('light', colorScheme === 'light')
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', colorScheme)
  syncTelegramChromeForPath(window.location.pathname)
}

/** Keep Telegram mini-app header in sync with current route atmosphere. */
export function syncTelegramChromeForPath(pathname: string) {
  const scheme =
    (document.documentElement.dataset.theme as ColorScheme | undefined) ?? 'dark'
  const isAdminHub = pathname === '/admin'

  if (isAdminHub) {
    const chrome = readAdminChrome()
    updateMetaThemeColor(chrome)
    applyTelegramChrome(chrome, scheme)
    return
  }

  const bg = readAppBackground()
  updateMetaThemeColor(bg)
  applyTelegramChrome(bg, scheme)
}
