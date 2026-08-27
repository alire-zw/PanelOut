import { Bot } from "grammy";
import { config } from "../config.js";
import { handleStart } from "./commands/start.js";
import { handleMyChatMember } from "./handlers/myChatMember.js";
import { log } from "../lib/logger.js";

export function createBot() {
  const bot = new Bot(config.botToken);

  bot.command("start", handleStart);
  bot.on("my_chat_member", handleMyChatMember);

  bot.catch((err) => {
    const updateId = err.ctx?.update?.update_id;
    log.error(
      "bot",
      `update ${updateId ?? "?"} · ${err.error?.message || err.error}`,
    );
  });

  return bot;
}
