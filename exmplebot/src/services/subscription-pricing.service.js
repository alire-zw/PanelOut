import { DEFAULT_SUBSCRIPTION_PRICING } from "../constants/pricing-defaults.js";
import {
  OUTBOUND_USAGE_CRITICAL_BALANCE_GB,
  OUTBOUND_USAGE_EXISTING_RESERVE_GB,
  OUTBOUND_USAGE_LOW_BALANCE_GB,
  OUTBOUND_USAGE_MIN_BALANCE_GB,
  PANEL_USAGE_CRITICAL_BALANCE_GB,
  PANEL_USAGE_LOW_BALANCE_GB,
  PANEL_USAGE_MIN_BALANCE_GB,
} from "../constants/service-types.js";
import { prisma } from "../db/prisma.js";
import { redis } from "../db/redis.js";
import { getBalanceThresholdIrt } from "../lib/outbound-usage-billing.js";


const SETTINGS_ID = 1;
const CACHE_KEY = "pricing:subscription";
const CACHE_TTL_SECONDS = 300;

export const PricingField = {
  PANEL_USAGE_PRICE_PER_GB: "panelUsagePricePerGb",
  OUTBOUND_PRICE_PER_GB: "outboundPricePerGb",
  PANEL_UNLIMITED_PRICE_PER_SUB: "panelUnlimitedPricePerSub",
  PANEL_UNLIMITED_PRICE_PER_USER: "panelUnlimitedPricePerUser",
};

const FIELD_DB_MAP = {
  [PricingField.PANEL_USAGE_PRICE_PER_GB]: "panelUsagePricePerGb",
  [PricingField.OUTBOUND_PRICE_PER_GB]: "outboundPricePerGb",
  [PricingField.PANEL_UNLIMITED_PRICE_PER_SUB]: "panelUnlimitedPricePerSub",
  [PricingField.PANEL_UNLIMITED_PRICE_PER_USER]: "panelUnlimitedPricePerUser",
};

function parseDateValue(value) {
  if (value == null) return null;

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizePricing(record) {
  return {
    panelUsagePricePerGb:
      Number(record?.panelUsagePricePerGb) ||
      DEFAULT_SUBSCRIPTION_PRICING.panelUsagePricePerGb,
    outboundPricePerGb:
      Number(record?.outboundPricePerGb) ||
      DEFAULT_SUBSCRIPTION_PRICING.outboundPricePerGb,
    panelUnlimitedPricePerSub:
      Number(record?.panelUnlimitedPricePerSub) ||
      DEFAULT_SUBSCRIPTION_PRICING.panelUnlimitedPricePerSub,
    panelUnlimitedPricePerUser:
      Number(record?.panelUnlimitedPricePerUser) ||
      DEFAULT_SUBSCRIPTION_PRICING.panelUnlimitedPricePerUser,
    dateUpdated: parseDateValue(record?.dateUpdated),
  };
}

async function invalidatePricingCache() {
  await redis.del(CACHE_KEY);
}

export async function getSubscriptionPricingRecord() {
  return prisma.subscriptionPricing.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...DEFAULT_SUBSCRIPTION_PRICING },
    update: {},
  });
}

export async function getSubscriptionPricing() {
  const cached = await redis.get(CACHE_KEY);

  if (cached) {
    try {
      return normalizePricing(JSON.parse(cached));
    } catch {
      await invalidatePricingCache();
    }
  }

  const record = await getSubscriptionPricingRecord();
  const pricing = normalizePricing(record);

  await redis.set(
    CACHE_KEY,
    JSON.stringify(pricing),
    "EX",
    CACHE_TTL_SECONDS,
  );

  return pricing;
}

function parsePriceValue(value) {
  const parsed = Number(String(value).replace(/[^\d]/g, ""));

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("INVALID_PRICE");
  }

  return parsed;
}

export async function setSubscriptionPricingField(field, value, updatedBy) {
  const dbField = FIELD_DB_MAP[field];

  if (!dbField) {
    throw new Error("INVALID_FIELD");
  }

  const parsed = parsePriceValue(value);

  const record = await prisma.subscriptionPricing.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      ...DEFAULT_SUBSCRIPTION_PRICING,
      [dbField]: parsed,
      updatedBy: BigInt(updatedBy),
    },
    update: {
      [dbField]: parsed,
      updatedBy: BigInt(updatedBy),
      dateUpdated: new Date(),
    },
  });

  await invalidatePricingCache();

  return normalizePricing(record);
}

export function buildPanelUsageBillingContext(pricing) {
  const pricePerGb = pricing.panelUsagePricePerGb;

  return {
    pricePerGb,
    lowBalance10GbIrt: getBalanceThresholdIrt(PANEL_USAGE_LOW_BALANCE_GB, pricePerGb),
    lowBalance5GbIrt: getBalanceThresholdIrt(PANEL_USAGE_CRITICAL_BALANCE_GB, pricePerGb),
    reactivateMinIrt: getBalanceThresholdIrt(PANEL_USAGE_MIN_BALANCE_GB, pricePerGb),
  };
}

export function buildOutboundUsageBillingContext(pricing) {
  const pricePerGb = pricing.outboundPricePerGb;

  return {
    pricePerGb,
    lowBalance10GbIrt: getBalanceThresholdIrt(OUTBOUND_USAGE_LOW_BALANCE_GB, pricePerGb),
    lowBalance5GbIrt: getBalanceThresholdIrt(OUTBOUND_USAGE_CRITICAL_BALANCE_GB, pricePerGb),
    reactivateMinIrt: getBalanceThresholdIrt(OUTBOUND_USAGE_MIN_BALANCE_GB, pricePerGb),
  };
}

export function getPanelUsageMinimumBalanceIrtFromPricing(pricing) {
  return buildPanelUsageBillingContext(pricing).reactivateMinIrt;
}

export function getOutboundUsageMinimumBalanceIrtFromPricing(pricing, existingCount = 0) {
  const requiredGb =
    OUTBOUND_USAGE_MIN_BALANCE_GB + Number(existingCount) * OUTBOUND_USAGE_EXISTING_RESERVE_GB;

  return getBalanceThresholdIrt(requiredGb, pricing.outboundPricePerGb);
}
