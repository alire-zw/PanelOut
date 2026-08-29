import { ServiceType, SubscriptionPanelStatus } from "../constants/service-types.js";
import { prisma } from "../db/prisma.js";
import {
  maxOutboundSerialFromNames,
  outboundSubscriptionNameKey,
} from "../lib/outbound-subscription-naming.js";

export async function getRecentSubscriptionsByServer(serverId, limit = 10) {
  return prisma.userSubscription.findMany({
    where: { serverId: BigInt(serverId) },
    orderBy: { dateCreated: "desc" },
    take: limit,
    select: {
      clientEmail: true,
      remark: true,
    },
  });
}

export async function findSubscriptionByClientEmailAndServer(clientEmail, serverId) {
  return prisma.userSubscription.findFirst({
    where: {
      serverId: BigInt(serverId),
      clientEmail,
    },
  });
}

export async function isSubscriptionNameTakenOnServer(serverId, clientEmail) {
  const key = outboundSubscriptionNameKey(clientEmail);
  if (!key) return true;

  const rows = await prisma.userSubscription.findMany({
    where: { serverId: BigInt(serverId) },
    select: { clientEmail: true, remark: true },
  });

  return rows.some((row) => {
    const names = [row.clientEmail, row.remark].filter(Boolean);
    return names.some((name) => outboundSubscriptionNameKey(name) === key);
  });
}

export async function maxSerialFromSubscriptionDb(serverId, prefix) {
  const rows = await prisma.userSubscription.findMany({
    where: { serverId: BigInt(serverId) },
    select: { clientEmail: true, remark: true },
  });

  const names = rows.flatMap((row) => [row.clientEmail, row.remark].filter(Boolean));
  return maxOutboundSerialFromNames(names, prefix);
}

export async function getUserSubscriptions(userId) {
  return prisma.userSubscription.findMany({
    where: { userId: BigInt(userId) },
    orderBy: { dateCreated: "desc" },
    include: { server: true },
  });
}

export async function findUserSubscriptionById(userId, subscriptionId) {
  return prisma.userSubscription.findFirst({
    where: {
      id: BigInt(subscriptionId),
      userId: BigInt(userId),
    },
    include: { server: true },
  });
}

const outboundUsageNotDeactivatedWhere = {
  serviceType: ServiceType.OUTBOUND_USAGE,
  panelStatus: { not: SubscriptionPanelStatus.DEACTIVATED },
};

export async function findUserOutboundUsageSubscription(userId) {
  return prisma.userSubscription.findFirst({
    where: {
      userId: BigInt(userId),
      ...outboundUsageNotDeactivatedWhere,
    },
    orderBy: { dateCreated: "desc" },
  });
}

export async function findUserLatestOutboundUsageSubscription(userId) {
  return prisma.userSubscription.findFirst({
    where: {
      userId: BigInt(userId),
      ...outboundUsageNotDeactivatedWhere,
    },
    orderBy: { dateCreated: "desc" },
    include: { server: true },
  });
}

export async function countUserNonDeactivatedOutboundUsageSubscriptions(userId) {
  return prisma.userSubscription.count({
    where: {
      userId: BigInt(userId),
      ...outboundUsageNotDeactivatedWhere,
    },
  });
}

export async function findUserOutboundUsageSubscriptionById(userId, subscriptionId) {
  return prisma.userSubscription.findFirst({
    where: {
      id: BigInt(subscriptionId),
      userId: BigInt(userId),
      serviceType: ServiceType.OUTBOUND_USAGE,
      panelStatus: { not: SubscriptionPanelStatus.DEACTIVATED },
    },
    include: { server: true },
  });
}

export async function findUserPanelTrialSubscription(userId) {
  return prisma.userSubscription.findFirst({
    where: {
      userId: BigInt(userId),
      serviceType: ServiceType.PANEL_TRIAL,
    },
    orderBy: { dateCreated: "desc" },
  });
}

export async function findUserPanelUnlimitedSubscription(userId) {
  return prisma.userSubscription.findFirst({
    where: {
      userId: BigInt(userId),
      serviceType: ServiceType.PANEL_UNLIMITED,
    },
    orderBy: { dateCreated: "desc" },
  });
}

export async function findUserPanelUsageSubscription(userId) {
  return prisma.userSubscription.findFirst({
    where: {
      userId: BigInt(userId),
      serviceType: ServiceType.PANEL_USAGE,
      panelStatus: { not: SubscriptionPanelStatus.DEACTIVATED },
    },
    orderBy: { dateCreated: "desc" },
    include: { server: true },
  });
}

export async function savePanelUnlimitedSubscription(data, { isUpgrade = false } = {}) {
  const serverId = BigInt(data.serverId);
  const clientEmail = String(data.clientEmail || "").trim().toLowerCase();
  const existing = await findSubscriptionByClientEmailAndServer(clientEmail, serverId);

  if (existing) {
    if (!isUpgrade) {
      return existing;
    }

    return prisma.userSubscription.update({
      where: { id: existing.id },
      data: {
        volumeGb: existing.volumeGb + Number(data.volumeGb),
        remark: data.remark ?? existing.remark,
        connectionLink: data.connectionLink ?? existing.connectionLink,
        panelSubId: data.panelSubId ?? existing.panelSubId,
      },
    });
  }

  return createUserSubscription(data);
}

export async function createUserSubscription(data) {
  return prisma.userSubscription.create({
    data: {
      userId: BigInt(data.userId),
      serverId: BigInt(data.serverId),
      serviceType: data.serviceType,
      volumeGb: data.volumeGb,
      groupIds: data.groupIds ?? null,
      connectionLink: data.connectionLink ?? null,
      panelSubId: data.panelSubId ?? null,
      clientEmail: data.clientEmail,
      remark: data.remark ?? data.clientEmail,
      paymentMethod: data.paymentMethod,
    },
  });
}
