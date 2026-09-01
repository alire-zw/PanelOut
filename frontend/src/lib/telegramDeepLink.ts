/** Maps Telegram `start_param` / `startapp` values to in-app routes. */
export const TELEGRAM_START_ROUTES: Record<string, string> = {
  panels: '/dashboard/panels',
  outbound: '/dashboard/outbound',
  wallet: '/wallet',
  dashboard: '/dashboard',
  panel: '/panel',
}

export function resolveTelegramStartPath(startParam: string | undefined | null): string | null {
  const key = startParam?.trim().toLowerCase()
  if (!key) return null
  return TELEGRAM_START_ROUTES[key] ?? null
}

export function readTelegramStartParam(): string | null {
  const fromInit = window.Telegram?.WebApp?.initDataUnsafe?.start_param?.trim()
  if (fromInit) return fromInit

  const params = new URLSearchParams(window.location.search)
  return (
    params.get('tgWebAppStartParam')?.trim()
    || params.get('startapp')?.trim()
    || null
  )
}
