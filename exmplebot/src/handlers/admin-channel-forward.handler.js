import { isAdminUser } from "../lib/admin.js";
import {
  deleteUserMessage,
  editPromptMessage,
  getPromptRefFromSession,
} from "../lib/prompt-message.js";
import { adminChannelAddCancelKeyboard } from "../keyboards/admin-channel.keyboard.js";
import { buildAdminChannelForwardInvalidMessage } from "../messages/admin-channel.message.js";
import {
  ChannelSessionMode,
  clearChannelSession,
  getChannelSession,
} from "../services/admin-channel-session.service.js";
import { processChannelForward } from "../services/admin-channel.service.js";

function hasForwardContent(message) {
  if (!message) return false;
  return Boolean(message.forward_origin || message.forward_from_chat);
}

export function registerAdminChannelForwardHandler(bot) {
  bot.on("message", async (ctx, next) => {
    if (!ctx.from || !isAdminUser(ctx.from.id)) {
      return next();
    }

    if (!hasForwardContent(ctx.message)) {
      return next();
    }

    const session = await getChannelSession(ctx.from.id);

    if (!session || session.mode !== ChannelSessionMode.ADD) {
      return next();
    }

    const promptRef = getPromptRefFromSession(session);

    try {
      const result = await processChannelForward(ctx.api, ctx.message);

      await deleteUserMessage(ctx);

      if (result.invalid) {
        await editPromptMessage(
          ctx.api,
          promptRef,
          buildAdminChannelForwardInvalidMessage(),
          adminChannelAddCancelKeyboard(),
        );
        return;
      }

      await clearChannelSession(ctx.from.id);
      await editPromptMessage(ctx.api, promptRef, result.text, result.keyboard);
    } catch (err) {
      await deleteUserMessage(ctx);
      await clearChannelSession(ctx.from.id);
      await editPromptMessage(
        ctx.api,
        promptRef,
        `⚠️ <b>${err.message || "خطا در افزودن کانال"}</b>`,
        adminChannelAddCancelKeyboard(),
      );
    }
  });
}
