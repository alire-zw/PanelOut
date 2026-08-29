import { buildUserEntryScreen } from "../services/user-entry.service.js";
import { getUserByTelegramId, syncUserFromTelegram } from "../services/user.service.js";

export function registerStartHandler(bot) {
  bot.command("start", async (ctx) => {
    if (ctx.from) {
      await syncUserFromTelegram(ctx.from);

      const user = await getUserByTelegramId(ctx.from.id);

      if (user?.isBanned) {
        await ctx.reply("❌ دسترسی شما مسدود است.");
        return;
      }
    }

    if (!ctx.from) {
      return;
    }

    const screen = await buildUserEntryScreen(ctx.api, ctx.from);

    await ctx.reply(screen.text, {
      parse_mode: "HTML",
      reply_markup: screen.keyboard,
    });
  });
}
