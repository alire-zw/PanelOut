import { prisma } from "../db/prisma.js";
import {
  checkPasarGuardConnection,
  clearPasarGuardClientCache,
  getPasarGuardStats,
  verifyPasarGuardConnection,
} from "./pasarguard.service.js";

export function isServerActive(server) {
  return server?.isActive !== false;
}

export function isServerSalesEnabled(server) {
  if (!isServerActive(server)) return false;
  return server?.salesEnabled !== false;
}

export function isServerRenewalEnabled(server) {
  return server?.renewalEnabled !== false;
}

export function isServerOutboundVolumeEnabled(server) {
  return server?.outboundVolumeEnabled !== false;
}

export function isServerOutboundUsageEnabled(server) {
  return server?.outboundUsageEnabled !== false;
}

export function isServerPanelVolumeEnabled(server) {
  return server?.panelVolumeEnabled !== false;
}

export function isServerPanelUsageEnabled(server) {
  return server?.panelUsageEnabled !== false;
}

export function isServerPanelUnlimitedEnabled(server) {
  return server?.panelUnlimitedEnabled !== false;
}

export function formatBytes(bytes) {
  if (bytes == null || bytes === 0 || Number.isNaN(bytes)) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const num = typeof bytes === "string" ? parseFloat(bytes) : Number(bytes);
  const i = Math.min(Math.floor(Math.log(num) / Math.log(k)), sizes.length - 1);

  return `${(num / k ** i).toFixed(2)} ${sizes[i]}`;
}

export async function getAllServers() {
  return prisma.server.findMany({
    orderBy: { dateCreated: "desc" },
  });
}

export async function findServerById(id) {
  return prisma.server.findUnique({
    where: { id: BigInt(id) },
  });
}

export async function createServer(data) {
  return prisma.server.create({
    data: {
      serverName: data.serverName,
      serverIp: data.serverIp,
      serverDomain: data.serverDomain ?? null,
      port: data.port,
      userName: data.userName,
      userPassword: data.userPassword,
      remark: data.remark ?? null,
      subPublicBaseUrl: data.subPublicBaseUrl ?? null,
      isActive: data.isActive ?? true,
      salesEnabled: data.salesEnabled ?? true,
      renewalEnabled: data.renewalEnabled ?? true,
      outboundVolumeEnabled: data.outboundVolumeEnabled ?? true,
      outboundUsageEnabled: data.outboundUsageEnabled ?? true,
      panelVolumeEnabled: data.panelVolumeEnabled ?? true,
      panelUsageEnabled: data.panelUsageEnabled ?? true,
      panelUnlimitedEnabled: data.panelUnlimitedEnabled ?? true,
    },
  });
}

export async function updateServer(id, data) {
  const patch = {};

  if (data.serverName !== undefined) patch.serverName = data.serverName;
  if (data.serverIp !== undefined) patch.serverIp = data.serverIp;
  if (data.serverDomain !== undefined) patch.serverDomain = data.serverDomain;
  if (data.port !== undefined) patch.port = data.port;
  if (data.userName !== undefined) patch.userName = data.userName;
  if (data.userPassword !== undefined) patch.userPassword = data.userPassword;
  if (data.remark !== undefined) patch.remark = data.remark;
  if (data.subPublicBaseUrl !== undefined) patch.subPublicBaseUrl = data.subPublicBaseUrl;
  if (data.isActive !== undefined) patch.isActive = data.isActive;
  if (data.salesEnabled !== undefined) patch.salesEnabled = data.salesEnabled;
  if (data.renewalEnabled !== undefined) patch.renewalEnabled = data.renewalEnabled;
  if (data.outboundVolumeEnabled !== undefined) {
    patch.outboundVolumeEnabled = data.outboundVolumeEnabled;
  }
  if (data.outboundUsageEnabled !== undefined) {
    patch.outboundUsageEnabled = data.outboundUsageEnabled;
  }
  if (data.panelVolumeEnabled !== undefined) patch.panelVolumeEnabled = data.panelVolumeEnabled;
  if (data.panelUsageEnabled !== undefined) patch.panelUsageEnabled = data.panelUsageEnabled;
  if (data.panelUnlimitedEnabled !== undefined) {
    patch.panelUnlimitedEnabled = data.panelUnlimitedEnabled;
  }

  if (
    data.userPassword !== undefined ||
    data.userName !== undefined ||
    data.serverDomain !== undefined
  ) {
    const row = await findServerById(id);

    if (row) {
      clearPasarGuardClientCache(row);
    }
  }

  return prisma.server.update({
    where: { id: BigInt(id) },
    data: patch,
  });
}

export async function deleteServer(id) {
  const row = await findServerById(id);

  if (row) {
    clearPasarGuardClientCache(row);
  }

  await prisma.server.delete({
    where: { id: BigInt(id) },
  });
}

export async function verifyServerConnection(serverLike) {
  return verifyPasarGuardConnection(serverLike);
}

export async function checkServerConnection(server) {
  return checkPasarGuardConnection(server);
}

export async function getServerStats(server) {
  return getPasarGuardStats(server);
}

export async function toggleServerActive(id) {
  const server = await findServerById(id);

  if (!server) return null;

  const nextActive = !isServerActive(server);

  return updateServer(id, {
    isActive: nextActive,
    salesEnabled: nextActive ? server.salesEnabled : false,
  });
}

export async function toggleServerSales(id) {
  const server = await findServerById(id);

  if (!server || !isServerActive(server)) return null;

  return updateServer(id, {
    salesEnabled: !isServerSalesEnabled(server),
  });
}

export async function toggleServerRenewal(id) {
  const server = await findServerById(id);

  if (!server) return null;

  return updateServer(id, {
    renewalEnabled: !isServerRenewalEnabled(server),
  });
}

export async function toggleServerOutboundVolume(id) {
  const server = await findServerById(id);
  if (!server) return null;
  return updateServer(id, {
    outboundVolumeEnabled: !isServerOutboundVolumeEnabled(server),
  });
}

export async function toggleServerOutboundUsage(id) {
  const server = await findServerById(id);
  if (!server) return null;
  return updateServer(id, {
    outboundUsageEnabled: !isServerOutboundUsageEnabled(server),
  });
}

export async function toggleServerPanelVolume(id) {
  const server = await findServerById(id);
  if (!server) return null;
  return updateServer(id, {
    panelVolumeEnabled: !isServerPanelVolumeEnabled(server),
  });
}

export async function toggleServerPanelUsage(id) {
  const server = await findServerById(id);
  if (!server) return null;
  return updateServer(id, {
    panelUsageEnabled: !isServerPanelUsageEnabled(server),
  });
}

export async function toggleServerPanelUnlimited(id) {
  const server = await findServerById(id);
  if (!server) return null;
  return updateServer(id, {
    panelUnlimitedEnabled: !isServerPanelUnlimitedEnabled(server),
  });
}
