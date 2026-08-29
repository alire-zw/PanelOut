import {
  adminChannelAddCancelKeyboard,
  adminChannelAddExistsKeyboard,
  adminChannelAddSuccessKeyboard,
  adminChannelDeleteConfirmKeyboard,
  adminChannelDetailKeyboard,
  adminChannelEditLabelCancelKeyboard,
  adminChannelsHubKeyboard,
  adminChannelsListKeyboard,
} from "../keyboards/admin-channel.keyboard.js";
import {
  buildAdminChannelAddExistsMessage,
  buildAdminChannelAddPromptMessage,
  buildAdminChannelAddSuccessMessage,
  buildAdminChannelDeleteConfirmMessage,
  buildAdminChannelDetailMessage,
  buildAdminChannelEditLabelPromptMessage,
  buildAdminChannelsHubMessage,
  buildAdminChannelsListMessage,
} from "../messages/admin-channel.message.js";
import { formatJalaliDateTime } from "../lib/tehran-time.js";
import {
  ChannelSessionMode,
  setChannelSession,
} from "../services/admin-channel-session.service.js";
import {
  createChannel,
  deleteChannelByTelegramId,
  findChannelByTelegramId,
  getAllChannels,
  getChannelRealMemberCount,
  resolveChannelInviteLink,
  updateChannelButtonLabel,
  updateChannelLockStatus,
  updateChannelMemberCount,
} from "../services/channel.service.js";

export async function buildAdminChannelsHubScreen() {
  const updatedAt = formatJalaliDateTime();

  return {
    text: buildAdminChannelsHubMessage(updatedAt),
    keyboard: adminChannelsHubKeyboard(),
  };
}

export async function buildAdminChannelsListScreen(page = 0) {
  const channels = await getAllChannels();
  const updatedAt = formatJalaliDateTime();
  const { keyboard } = adminChannelsListKeyboard(channels, page);

  return {
    text: buildAdminChannelsListMessage(updatedAt, channels.length),
    keyboard,
  };
}

export async function buildAdminChannelDetailScreen(channelId, api = null) {
  const channel = await findChannelByTelegramId(channelId);

  if (!channel) {
    throw new Error("CHANNEL_NOT_FOUND");
  }

  let memberCount = channel.memberCount;

  if (api) {
    const realCount = await getChannelRealMemberCount(api, channel.channelId);

    if (realCount !== null) {
      memberCount = realCount;
      await updateChannelMemberCount(channel.channelId, memberCount);
    }
  }

  const updatedAt = formatJalaliDateTime();

  return {
    text: buildAdminChannelDetailMessage(channel, memberCount, updatedAt),
    keyboard: adminChannelDetailKeyboard(channel),
  };
}

export async function buildAdminChannelAddStartScreen() {
  return {
    text: buildAdminChannelAddPromptMessage(),
    keyboard: adminChannelAddCancelKeyboard(),
    awaitsForward: true,
  };
}

export async function beginChannelAddSession(userId) {
  await setChannelSession(userId, {
    mode: ChannelSessionMode.ADD,
    step: "waiting_forward",
  });
}

export async function buildAdminChannelEditLabelStartScreen(channelId) {
  const channel = await findChannelByTelegramId(channelId);

  if (!channel) {
    throw new Error("CHANNEL_NOT_FOUND");
  }

  return {
    text: buildAdminChannelEditLabelPromptMessage(channel),
    keyboard: adminChannelEditLabelCancelKeyboard(channelId),
    awaitsTextInput: true,
  };
}

export async function beginChannelEditLabelSession(userId, channelId) {
  await setChannelSession(userId, {
    mode: ChannelSessionMode.EDIT_LABEL,
    channelId: String(channelId),
  });
}

export async function buildAdminChannelDeleteConfirmScreen(channelId) {
  const channel = await findChannelByTelegramId(channelId);

  if (!channel) {
    throw new Error("CHANNEL_NOT_FOUND");
  }

  return {
    text: buildAdminChannelDeleteConfirmMessage(channel),
    keyboard: adminChannelDeleteConfirmKeyboard(channelId),
  };
}

export async function handleAdminChannelToggleLock(channelId, api) {
  const channel = await findChannelByTelegramId(channelId);

  if (!channel) {
    throw new Error("CHANNEL_NOT_FOUND");
  }

  await updateChannelLockStatus(channelId, !channel.isLocked);

  return buildAdminChannelDetailScreen(channelId, api);
}

export async function handleAdminChannelDeleteConfirm(channelId) {
  await deleteChannelByTelegramId(channelId);
  return buildAdminChannelsListScreen(0);
}

export async function processChannelEditLabel(session, text) {
  const label = text.trim();

  if (!label || label.length > 255) {
    throw new Error("INVALID_LABEL");
  }

  await updateChannelButtonLabel(session.channelId, label);

  return buildAdminChannelDetailScreen(session.channelId);
}

function getForwardChannel(message) {
  if (!message) return null;

  if (message.forward_origin?.type === "channel") {
    return message.forward_origin.chat;
  }

  if (message.forward_from_chat?.type === "channel") {
    return message.forward_from_chat;
  }

  return null;
}

export async function processChannelForward(api, message) {
  const forwardChat = getForwardChannel(message);

  if (!forwardChat) {
    return { invalid: true };
  }

  const channelId = forwardChat.id;
  const channelName = forwardChat.title || "بدون نام";
  const channelUsername = forwardChat.username ?? null;

  const existing = await findChannelByTelegramId(channelId);

  if (existing) {
    return {
      exists: true,
      text: buildAdminChannelAddExistsMessage(existing),
      keyboard: adminChannelAddExistsKeyboard(),
    };
  }

  let memberCount = 0;

  try {
    const realCount = await getChannelRealMemberCount(api, channelId);

    if (realCount !== null) {
      memberCount = realCount;
    }
  } catch {
    // optional
  }

  const inviteLink = await resolveChannelInviteLink(api, channelId);

  const channel = await createChannel({
    channelId,
    channelName,
    channelUsername,
    inviteLink,
    memberCount,
    isLocked: false,
  });

  return {
    success: true,
    text: buildAdminChannelAddSuccessMessage(channel, memberCount),
    keyboard: adminChannelAddSuccessKeyboard(),
  };
}
