import { InlineKeyboard } from "grammy";
import { CallbackData } from "../constants/callbacks.js";
import { PremiumEmoji } from "../constants/emojis.js";
import { getLockedChannels } from "../services/channel.service.js";
import { checkUserMembership } from "../services/channel-membership.service.js";

export async function buildChannelMembershipKeyboard(api, userId) {
  const lockedChannels = await getLockedChannels();
  const keyboard = new InlineKeyboard();

  for (const channel of lockedChannels) {
    const isMember = await checkUserMembership(api, channel.channelId, userId);

    if (!isMember && channel.inviteLink) {
      keyboard.url(channel.buttonLabel || "عضویت در کانال", channel.inviteLink).row();
    }
  }

  keyboard
    .text("تأیید عضویت", CallbackData.VERIFY_MEMBERSHIP)
    .icon(PremiumEmoji.DEPOSIT_SUCCESS.id);

  return keyboard;
}
