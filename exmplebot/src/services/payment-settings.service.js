import { prisma } from "../db/prisma.js";
import { isValidTronAddress } from "./tron/tron.client.js";

const SETTINGS_ID = 1;

async function touchSettings(updatedBy, data) {
  return prisma.paymentSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, updatedBy: BigInt(updatedBy), ...data },
    update: {
      ...data,
      updatedBy: BigInt(updatedBy),
      dateUpdated: new Date(),
    },
  });
}

export async function getPaymentSettings() {
  return prisma.paymentSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID },
    update: {},
  });
}

export function isTronPaymentAvailable(settings) {
  return settings.tronEnabled;
}

export function isRialPaymentAvailable(settings) {
  return (
    settings.rialEnabled &&
    Boolean(settings.cardNumber || settings.shebaNumber)
  );
}

export async function getMasterWalletAddress() {
  const settings = await getPaymentSettings();
  return settings.masterWalletAddress;
}

export async function setMasterWalletAddress(address, updatedBy) {
  const normalized = address.trim();

  if (!isValidTronAddress(normalized)) {
    throw new Error("INVALID_ADDRESS");
  }

  return touchSettings(updatedBy, { masterWalletAddress: normalized });
}

export async function clearMasterWalletAddress(updatedBy) {
  return touchSettings(updatedBy, { masterWalletAddress: null });
}

export function normalizeCardNumber(value) {
  const digits = value.replace(/\D/g, "");

  if (digits.length !== 16) {
    throw new Error("INVALID_CARD");
  }

  return digits;
}

export function formatCardNumber(cardNumber) {
  return cardNumber.replace(/(\d{4})(?=\d)/g, "$1-");
}

export function normalizeShebaNumber(value) {
  let normalized = value.replace(/\s/g, "").toUpperCase();

  if (!normalized.startsWith("IR")) {
    normalized = `IR${normalized}`;
  }

  if (!/^IR\d{24}$/.test(normalized)) {
    throw new Error("INVALID_SHEBA");
  }

  return normalized;
}

export function formatShebaNumber(sheba) {
  const digits = sheba.slice(2);
  const groups = digits.match(/.{1,4}/g) ?? [];

  return `IR${groups.join(" ")}`;
}

export async function setCardNumber(value, updatedBy) {
  return touchSettings(updatedBy, {
    cardNumber: normalizeCardNumber(value),
  });
}

export async function clearCardNumber(updatedBy) {
  return touchSettings(updatedBy, { cardNumber: null });
}

export async function setShebaNumber(value, updatedBy) {
  return touchSettings(updatedBy, {
    shebaNumber: normalizeShebaNumber(value),
  });
}

export async function clearShebaNumber(updatedBy) {
  return touchSettings(updatedBy, { shebaNumber: null });
}

export async function toggleTronEnabled(updatedBy) {
  const settings = await getPaymentSettings();

  return touchSettings(updatedBy, { tronEnabled: !settings.tronEnabled });
}

export async function toggleRialEnabled(updatedBy) {
  const settings = await getPaymentSettings();

  return touchSettings(updatedBy, { rialEnabled: !settings.rialEnabled });
}
