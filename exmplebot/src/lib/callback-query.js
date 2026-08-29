import { GrammyError } from "grammy";

function isExpiredCallbackError(err) {
  return (
    err instanceof GrammyError &&
    (err.description.includes("query is too old") ||
      err.description.includes("query ID is invalid"))
  );
}

export async function safeAnswerCallbackQuery(ctx, options) {
  try {
    await ctx.answerCallbackQuery(options);
    return true;
  } catch (err) {
    if (isExpiredCallbackError(err)) {
      return false;
    }

    throw err;
  }
}

export async function safeEditCallbackMessage(ctx, text, replyMarkup) {
  try {
    await ctx.editMessageText(text, {
      parse_mode: "HTML",
      reply_markup: replyMarkup,
      link_preview_options: { is_disabled: true },
    });
  } catch (err) {
    if (
      err instanceof GrammyError &&
      err.description.includes("message is not modified")
    ) {
      return;
    }

    throw err;
  }
}
