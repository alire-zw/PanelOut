import { InlineKeyboard } from "grammy";
import { config } from "../../config.js";
import { upsertUserFromTelegram } from "../../db/users.js";
import { log } from "../../lib/logger.js";

const START_TEXT = [
  "👍 ممنون که پنلوت رو انتخاب کردید.",
  "",
  "🤓 پنلوت زیرساختی برای فروشندگان فراهم کرده است تا با دریافت پنل اختصاصی، به‌سادگی کاربران خود را مدیریت کرده و سرویس‌های پایدار و باکیفیت به مشتریان ارائه دهند.",
  "",
  "🐙 برای شروع از دکمه‌های زیر استفاده کنید:",
].join("\n");

export function createStartKeyboard() {
  return new InlineKeyboard().webApp("ورود به مینی اپ", config.miniAppUrl);
}

export async function handleStart(ctx) {
  if (ctx.from) {
    try {
      const user = await upsertUserFromTelegram(ctx.from);
      const handle = ctx.from.username ? `@${ctx.from.username}` : String(ctx.from.id);
      log.event("start", `${handle}  #${user.id}`);
    } catch (error) {
      log.error("upsert", error);
    }
  }

  await ctx.reply(START_TEXT, {
    reply_markup: createStartKeyboard(),
  });
}
