import { pickRandomInvalidMessageEmoji, premiumEmoji } from "../constants/emojis.js";
import { isUserInAwaitingInputState } from "../services/input-state.service.js";
import { replyUserEntryScreen } from "../services/user-entry.service.js";

const REACTION_DELAY_MS = 3000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function deleteMessageSafe(api, chatId, messageId) {
  try {
    await api.deleteMessage(chatId, messageId);
  } catch {
    // Message may already be deleted.
  }
}

export function registerInvalidMessageHandler(bot) {
  bot.on("message", async (ctx, next) => {
    if (!ctx.from || ctx.chat?.type !== "private") {
      return next();
    }

    if (ctx.message?.text?.startsWith("/")) {
      return next();
    }

    if (await isUserInAwaitingInputState(ctx.from.id)) {
      return;
    }

    const emoji = pickRandomInvalidMessageEmoji();
    const reaction = await ctx.reply(premiumEmoji(emoji), {
      parse_mode: "HTML",
    });

    await sleep(REACTION_DELAY_MS);
    await deleteMessageSafe(ctx.api, reaction.chat.id, reaction.message_id);
    await replyUserEntryScreen(ctx);
  });
}
