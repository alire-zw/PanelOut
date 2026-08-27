/** Shared Telegram Bot API handle for HTTP routes. */

/** @type {import('grammy').Api | null} */
let botApi = null;

export function setBotApi(api) {
  botApi = api;
}

export function getBotApi() {
  if (!botApi) {
    throw Object.assign(new Error("Bot API is not initialized"), { status: 503 });
  }
  return botApi;
}
