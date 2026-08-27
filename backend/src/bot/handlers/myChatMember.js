import { deactivateAdminSystemChannelsByChatId } from "../../db/systemChannels.js";
import { log } from "../../lib/logger.js";

/**
 * When bot is removed/demoted from a channel, unlock membership gates for that chat.
 */
export async function handleMyChatMember(ctx) {
  const update = ctx.update.my_chat_member;
  if (!update) return;

  const chat = update.chat;
  if (!chat || chat.type !== "channel") return;

  const newStatus = update.new_chat_member?.status;
  const stillAdmin =
    newStatus === "administrator" || newStatus === "creator";

  if (stillAdmin) return;

  try {
    await deactivateAdminSystemChannelsByChatId(chat.id);
    log.event(
      "channels",
      `bot left/demoted chat:${chat.id} · lock slots deactivated`,
    );
  } catch (error) {
    log.error("channels", error);
  }
}
