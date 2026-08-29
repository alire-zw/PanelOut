import { prisma } from "../db/prisma.js";
import { MIN_PANEL_UNLIMITED_COUNT } from "../constants/panel-unlimited.js";

const SETTINGS_ID = 1;

export async function getPanelSettings() {
  return prisma.panelSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID },
    update: {},
  });
}

export async function getPanelUnlimitedAvailability() {
  const settings = await getPanelSettings();
  const capacity = Math.max(0, Number(settings.unlimitedCapacity) || 0);
  const sold = Math.max(0, Number(settings.unlimitedSold) || 0);
  const remaining = Math.max(0, capacity - sold);

  return {
    capacity,
    sold,
    remaining,
    canPurchase: remaining >= MIN_PANEL_UNLIMITED_COUNT,
    dateUpdated: settings.dateUpdated,
  };
}

export async function setPanelUnlimitedCapacity(capacity, updatedBy) {
  const value = Number(capacity);

  if (!Number.isInteger(value) || value < 0) {
    throw new Error("INVALID_CAPACITY");
  }

  const settings = await getPanelSettings();
  const sold = Math.max(0, Number(settings.unlimitedSold) || 0);

  if (value < sold) {
    throw new Error("CAPACITY_BELOW_SOLD");
  }

  return prisma.panelSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      unlimitedCapacity: value,
      updatedBy: BigInt(updatedBy),
    },
    update: {
      unlimitedCapacity: value,
      updatedBy: BigInt(updatedBy),
      dateUpdated: new Date(),
    },
  });
}

export async function reservePanelUnlimitedSlots(count) {
  const slots = Number(count);

  if (!Number.isInteger(slots) || slots < MIN_PANEL_UNLIMITED_COUNT) {
    throw new Error("INVALID_COUNT");
  }

  return prisma.$transaction(async (tx) => {
    const settings = await tx.panelSettings.findUnique({
      where: { id: SETTINGS_ID },
    });

    const capacity = Math.max(0, Number(settings?.unlimitedCapacity) || 0);
    const sold = Math.max(0, Number(settings?.unlimitedSold) || 0);
    const remaining = capacity - sold;

    if (slots > remaining) {
      throw new Error("INSUFFICIENT_CAPACITY");
    }

    return tx.panelSettings.upsert({
      where: { id: SETTINGS_ID },
      create: {
        id: SETTINGS_ID,
        unlimitedCapacity: capacity,
        unlimitedSold: slots,
      },
      update: {
        unlimitedSold: sold + slots,
        dateUpdated: new Date(),
      },
    });
  });
}
