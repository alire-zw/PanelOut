import { prisma } from "../db/prisma.js";

export async function findChannelByTelegramId(channelId) {
  return prisma.channel.findUnique({
    where: { channelId: BigInt(channelId) },
  });
}

export async function getAllChannels() {
  return prisma.channel.findMany({
    orderBy: { dateCreated: "desc" },
  });
}

export async function getLockedChannels() {
  return prisma.channel.findMany({
    where: { isLocked: true },
    orderBy: { dateCreated: "asc" },
  });
}

export async function createChannel(data) {
  return prisma.channel.create({
    data: {
      channelId: BigInt(data.channelId),
      channelName: data.channelName,
      channelUsername: data.channelUsername ?? null,
      buttonLabel: data.buttonLabel ?? "تایید عضویت",
      inviteLink: data.inviteLink ?? null,
      isLocked: data.isLocked ?? false,
      memberCount: data.memberCount ?? 0,
    },
  });
}

export async function updateChannelLockStatus(channelId, isLocked) {
  return prisma.channel.update({
    where: { channelId: BigInt(channelId) },
    data: { isLocked },
  });
}

export async function updateChannelButtonLabel(channelId, buttonLabel) {
  return prisma.channel.update({
    where: { channelId: BigInt(channelId) },
    data: { buttonLabel },
  });
}

export async function updateChannelMemberCount(channelId, memberCount) {
  return prisma.channel.update({
    where: { channelId: BigInt(channelId) },
    data: { memberCount },
  });
}

export async function deleteChannelByTelegramId(channelId) {
  return prisma.channel.delete({
    where: { channelId: BigInt(channelId) },
  });
}

export async function getChannelRealMemberCount(api, channelId) {
  try {
    return await api.getChatMemberCount(Number(channelId));
  } catch {
    return null;
  }
}

export async function resolveChannelInviteLink(api, channelId) {
  try {
    const botInfo = await api.getMe();
    const member = await api.getChatMember(Number(channelId), botInfo.id);

    if (member.status === "administrator" || member.status === "creator") {
      return await api.exportChatInviteLink(Number(channelId));
    }
  } catch {
    // invite link optional
  }

  return null;
}
