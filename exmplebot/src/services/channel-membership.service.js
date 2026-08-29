import { getLockedChannels } from "./channel.service.js";
import { buildChannelMembershipKeyboard } from "../keyboards/channel-membership.keyboard.js";
import { channelMembershipMessage } from "../messages/channel-membership.message.js";

const MEMBER_STATUSES = new Set(["member", "administrator", "creator"]);

export async function checkUserMembership(api, channelId, userId) {
  try {
    const member = await api.getChatMember(Number(channelId), userId);
    return MEMBER_STATUSES.has(member.status);
  } catch {
    return false;
  }
}

export async function checkUserMembershipInAllChannels(api, userId) {
  const lockedChannels = await getLockedChannels();

  if (lockedChannels.length === 0) {
    return {
      allJoined: true,
      missingChannels: [],
      joinedChannels: [],
    };
  }

  const missingChannels = [];
  const joinedChannels = [];

  for (const channel of lockedChannels) {
    const isMember = await checkUserMembership(api, channel.channelId, userId);

    if (isMember) {
      joinedChannels.push(channel);
    } else {
      missingChannels.push(channel);
    }
  }

  return {
    allJoined: missingChannels.length === 0,
    missingChannels,
    joinedChannels,
  };
}

export async function buildChannelMembershipScreenIfNeeded(api, userId) {
  const check = await checkUserMembershipInAllChannels(api, userId);

  if (check.allJoined) {
    return null;
  }

  const keyboard = await buildChannelMembershipKeyboard(api, userId);

  return {
    text: channelMembershipMessage,
    keyboard,
  };
}
