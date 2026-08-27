let cachedBotUsername: string | null = null
let cachedBotId: number | null = null

export function setBotUsername(username: string): void {
  cachedBotUsername = username.replace(/^@/, '') || null
}

export function getBotUsername(): string | null {
  return cachedBotUsername
}

export function setBotId(id: number): void {
  cachedBotId = id
}

export function getBotId(): number | null {
  return cachedBotId
}
