import { GrammyError } from "grammy";

export function getPromptRefFromCallback(ctx) {
  const message = ctx.callbackQuery?.message;

  if (!message) {
    return null;
  }

  return {
    chatId: message.chat.id,
    messageId: message.message_id,
  };
}

export function getPromptRefFromSession(session) {
  if (!session?.promptChatId || !session?.promptMessageId) {
    return null;
  }

  return {
    chatId: Number(session.promptChatId),
    messageId: Number(session.promptMessageId),
  };
}

export async function deleteUserMessage(ctx) {
  try {
    await ctx.deleteMessage();
  } catch {
    // Message may already be deleted or too old.
  }
}

export async function editPromptMessage(api, promptRef, text, replyMarkup) {
  if (!promptRef) {
    return false;
  }

  try {
    await api.editMessageText(promptRef.chatId, promptRef.messageId, text, {
      parse_mode: "HTML",
      reply_markup: replyMarkup,
    });
    return true;
  } catch (err) {
    if (
      err instanceof GrammyError &&
      err.description.includes("message is not modified")
    ) {
      return true;
    }

    throw err;
  }
}
