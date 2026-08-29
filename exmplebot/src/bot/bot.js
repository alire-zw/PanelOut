import { autoRetry } from "@grammyjs/auto-retry";
import { Bot, HttpError } from "grammy";
import { ProxyAgent } from "undici";
import { env } from "../config/env.js";
import { registerHandlers } from "../handlers/index.js";
import { logger } from "../lib/logger.js";

function buildBotOptions() {
  if (!env.telegramProxy) {
    return undefined;
  }

  return {
    client: {
      baseFetchConfig: {
        dispatcher: new ProxyAgent(env.telegramProxy),
      },
    },
  };
}

export function createBot() {
  const bot = new Bot(env.botToken, buildBotOptions());

  bot.api.config.use(
    autoRetry({
      maxRetryAttempts: env.telegramMaxRetries,
      maxDelaySeconds: 30,
    }),
  );

  registerHandlers(bot);

  bot.catch(({ error }) => {
    const message = error?.description ?? error?.message;

    if (
      message?.includes("query is too old") ||
      message?.includes("query ID is invalid")
    ) {
      return;
    }

    if (error instanceof HttpError) {
      const cause = error.cause?.message ?? error.message;
      logger.error("bot", `telegram network: ${cause}`);
      return;
    }

    logger.error("bot", message ?? String(error));
  });

  return bot;
}
