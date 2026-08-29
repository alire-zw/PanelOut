import { prisma } from "../db/prisma.js";
import { logger } from "../lib/logger.js";

export async function getUserByTelegramId(telegramId) {
  return prisma.user.findUnique({
    where: { userId: BigInt(telegramId) },
  });
}

export async function getUserPanelUnlimitedMaxUsersLock(telegramId) {
  const user = await getUserByTelegramId(telegramId);

  if (!user?.panelUnlimitedMaxUsers) {
    return null;
  }

  return user.panelUnlimitedMaxUsers;
}

export async function getUserPanelUnlimitedAdmin(telegramId) {
  const user = await getUserByTelegramId(telegramId);

  if (!user?.panelUnlimitedAdminUsername) {
    return null;
  }

  return {
    username: user.panelUnlimitedAdminUsername,
    password: user.panelUnlimitedAdminPassword,
    roleId: user.panelUnlimitedAdminRoleId,
    maxUsersLock: user.panelUnlimitedMaxUsers,
  };
}

export async function savePanelUnlimitedAdminCredentials(
  telegramId,
  { username, password, roleId, maxUsers },
) {
  return prisma.user.update({
    where: { userId: BigInt(telegramId) },
    data: {
      panelUnlimitedAdminUsername: username,
      panelUnlimitedAdminPassword: password,
      panelUnlimitedAdminRoleId: roleId ?? null,
      panelUnlimitedMaxUsers: maxUsers,
      dateUpdated: new Date(),
    },
  });
}

export async function updatePanelUnlimitedMaxUsersLock(telegramId, maxUsers) {
  const user = await getUserByTelegramId(telegramId);
  const nextMaxUsers = Math.max(Number(user?.panelUnlimitedMaxUsers) || 0, Number(maxUsers) || 0);

  return prisma.user.update({
    where: { userId: BigInt(telegramId) },
    data: {
      panelUnlimitedMaxUsers: nextMaxUsers,
      dateUpdated: new Date(),
    },
  });
}

export async function savePanelUsageAdminPassword(telegramId, password) {
  return prisma.user.update({
    where: { userId: BigInt(telegramId) },
    data: {
      panelUsageAdminPassword: password,
      dateUpdated: new Date(),
    },
  });
}

function buildFullname(from) {
  return [from.first_name, from.last_name].filter(Boolean).join(" ").trim();
}

function mapTelegramUser(from) {
  return {
    userId: BigInt(from.id),
    username: from.username ?? null,
    userFullname: buildFullname(from),
    isPremium: from.is_premium ?? false,
  };
}

function hasProfileChanges(existing, incoming) {
  return (
    existing.username !== incoming.username ||
    existing.userFullname !== incoming.userFullname ||
    existing.isPremium !== incoming.isPremium
  );
}

export async function syncUserFromTelegram(from) {
  const incoming = mapTelegramUser(from);

  const existing = await prisma.user.findUnique({
    where: { userId: incoming.userId },
  });

  if (!existing) {
    const user = await prisma.user.create({
      data: {
        ...incoming,
        balance: 0,
        isBanned: false,
      },
    });

    logger.info("user", `new ${from.id}`);
    return user;
  }

  if (!hasProfileChanges(existing, incoming)) {
    return existing;
  }

  const user = await prisma.user.update({
    where: { userId: incoming.userId },
    data: {
      username: incoming.username,
      userFullname: incoming.userFullname,
      isPremium: incoming.isPremium,
      dateUpdated: new Date(),
    },
  });

  logger.info("user", `updated ${from.id}`);
  return user;
}
