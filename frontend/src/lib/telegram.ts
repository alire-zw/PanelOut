export function isTelegramWebApp() {
  return Boolean(window.Telegram?.WebApp?.initData)
}
