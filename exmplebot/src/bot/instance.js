/** @type {import("grammy").Bot | null} */
let botInstance = null;

export function setBotInstance(bot) {
  botInstance = bot;
}

export function getBotInstance() {
  return botInstance;
}
