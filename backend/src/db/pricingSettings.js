import { getSql } from "./postgres.js";
import { redis } from "./redis.js";
import { log } from "../lib/logger.js";

const SETTINGS_ID = 1;
const CACHE_KEY = "pricing:subscription:v1";
const CACHE_TTL_SECONDS = 300;

export const DEFAULT_SUBSCRIPTION_PRICING = Object.freeze({
  panelUsagePricePerGb: 4000,
  outboundPricePerGb: 4000,
  panelUnlimitedPricePerSub: 4000,
  panelUnlimitedPricePerUser: 5000,
});

export async function ensurePricingSettingsTable() {
  const sql = getSql();

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS subscription_pricing (
      id                            BIGINT PRIMARY KEY DEFAULT 1,
      panel_usage_price_per_gb      INT NOT NULL DEFAULT 4000,
      outbound_price_per_gb         INT NOT NULL DEFAULT 4000,
      panel_unlimited_price_per_sub INT NOT NULL DEFAULT 4000,
      panel_unlimited_price_per_user INT NOT NULL DEFAULT 5000,
      updated_by                    BIGINT NULL,
      date_updated                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT subscription_pricing_singleton CHECK (id = 1)
    )
  `);

  await sql`
    INSERT INTO subscription_pricing (
      id,
      panel_usage_price_per_gb,
      outbound_price_per_gb,
      panel_unlimited_price_per_sub,
      panel_unlimited_price_per_user
    )
    VALUES (
      ${SETTINGS_ID},
      ${DEFAULT_SUBSCRIPTION_PRICING.panelUsagePricePerGb},
      ${DEFAULT_SUBSCRIPTION_PRICING.outboundPricePerGb},
      ${DEFAULT_SUBSCRIPTION_PRICING.panelUnlimitedPricePerSub},
      ${DEFAULT_SUBSCRIPTION_PRICING.panelUnlimitedPricePerUser}
    )
    ON CONFLICT (id) DO NOTHING
  `;
}

function normalizePricing(row) {
  if (!row) {
    return {
      ...DEFAULT_SUBSCRIPTION_PRICING,
      updatedBy: null,
      dateUpdated: null,
    };
  }

  return {
    panelUsagePricePerGb:
      Number(row.panel_usage_price_per_gb) ||
      DEFAULT_SUBSCRIPTION_PRICING.panelUsagePricePerGb,
    outboundPricePerGb:
      Number(row.outbound_price_per_gb) ||
      DEFAULT_SUBSCRIPTION_PRICING.outboundPricePerGb,
    panelUnlimitedPricePerSub:
      Number(row.panel_unlimited_price_per_sub) ||
      DEFAULT_SUBSCRIPTION_PRICING.panelUnlimitedPricePerSub,
    panelUnlimitedPricePerUser:
      Number(row.panel_unlimited_price_per_user) ||
      DEFAULT_SUBSCRIPTION_PRICING.panelUnlimitedPricePerUser,
    updatedBy: row.updated_by != null ? Number(row.updated_by) : null,
    dateUpdated: row.date_updated
      ? new Date(row.date_updated).toISOString()
      : null,
  };
}

export async function invalidatePricingCache() {
  try {
    await redis.del(CACHE_KEY);
  } catch {
    // ignore redis error
  }
}

export async function getPricingSettings() {
  try {
    const cached = await redis.get(CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {
    // fallback to postgres
  }

  const sql = getSql();
  await ensurePricingSettingsTable();

  const [row] = await sql`
    SELECT *
    FROM subscription_pricing
    WHERE id = ${SETTINGS_ID}
  `;

  const normalized = normalizePricing(row);

  try {
    await redis.set(
      CACHE_KEY,
      JSON.stringify(normalized),
      "EX",
      CACHE_TTL_SECONDS,
    );
  } catch {
    // ignore
  }

  return normalized;
}

export async function getPanelUsagePricePerGb() {
  const pricing = await getPricingSettings();
  return pricing.panelUsagePricePerGb;
}

function parsePrice(value, fieldName) {
  if (value === undefined || value === null) return undefined;
  const num = typeof value === "string" ? Number(value.replace(/[^\d]/g, "")) : Number(value);
  if (!Number.isInteger(num) || num < 100 || num > 100_000_000) {
    const err = new Error(`مقدار نامعتبر برای ${fieldName}. حداقل ۱۰۰ تومان است`);
    err.status = 400;
    throw err;
  }
  return num;
}

export async function updatePricingSettings(input = {}, updatedBy = null) {
  await ensurePricingSettingsTable();

  const panelUsagePricePerGb = parsePrice(input.panelUsagePricePerGb, "قیمت هر گیگ پنل");
  const outboundPricePerGb = parsePrice(input.outboundPricePerGb, "قیمت هر گیگ اوتباند");
  const panelUnlimitedPricePerSub = parsePrice(input.panelUnlimitedPricePerSub, "قیمت هر ساب نامحدود");
  const panelUnlimitedPricePerUser = parsePrice(input.panelUnlimitedPricePerUser, "قیمت هر کاربر نامحدود");

  const sql = getSql();
  const current = await getPricingSettings();

  const nextUsage = panelUsagePricePerGb ?? current.panelUsagePricePerGb;
  const nextOutbound = outboundPricePerGb ?? current.outboundPricePerGb;
  const nextUnlimSub = panelUnlimitedPricePerSub ?? current.panelUnlimitedPricePerSub;
  const nextUnlimUser = panelUnlimitedPricePerUser ?? current.panelUnlimitedPricePerUser;

  const [row] = await sql`
    UPDATE subscription_pricing
    SET
      panel_usage_price_per_gb = ${nextUsage},
      outbound_price_per_gb = ${nextOutbound},
      panel_unlimited_price_per_sub = ${nextUnlimSub},
      panel_unlimited_price_per_user = ${nextUnlimUser},
      updated_by = ${updatedBy ?? null},
      date_updated = NOW()
    WHERE id = ${SETTINGS_ID}
    RETURNING *
  `;

  await invalidatePricingCache();
  const normalized = normalizePricing(row);

  log.event(
    "pricing",
    `updated pricing by:${updatedBy || "system"} usage:${normalized.panelUsagePricePerGb} outbound:${normalized.outboundPricePerGb}`,
  );

  return normalized;
}
