import { startKeyboard } from "../keyboards/index.js";
import { isAdminUser } from "../lib/admin.js";
import { startMessage } from "../messages/start.message.js";
import { buildChannelMembershipScreenIfNeeded } from "./channel-membership.service.js";
import { getUserByTelegramId } from "./user.service.js";

export async function buildUserEntryScreen(api, from) {
  const isAdmin = isAdminUser(from.id);

  if (!isAdmin) {
    const membership = await buildChannelMembershipScreenIfNeeded(api, from.id);

    if (membership) {
      return membership;
    }
  }

  return {
    text: startMessage,
    keyboard: startKeyboard(isAdmin),
  };
}

export async function replyUserEntryScreen(ctx) {
  if (!ctx.from) {
    return false;
  }

  const user = await getUserByTelegramId(ctx.from.id);

  if (user?.isBanned) {
    return false;
  }

  const screen = await buildUserEntryScreen(ctx.api, ctx.from);

  await ctx.reply(screen.text, {
    parse_mode: "HTML",
    reply_markup: screen.keyboard,
  });

  return true;
}
