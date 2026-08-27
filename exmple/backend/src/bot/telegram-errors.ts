import { BotError, GrammyError } from 'grammy'

/** Errors that should not fail the webhook (Telegram already delivered the update). */
export function isIgnorableTelegramDeliveryError(error: unknown): boolean {
  const err = error instanceof BotError ? error.error : error
  if (!(err instanceof GrammyError)) return false

  if (err.error_code === 403) return true

  const description = err.description ?? ''
  if (
    err.error_code === 400 &&
    /chat not found|user is deactivated|bot was blocked|PEER_ID_INVALID/i.test(description)
  ) {
    return true
  }

  return /blocked by the user|bot was blocked|user is deactivated/i.test(description)
}
