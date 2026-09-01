export const GB_BYTES = 1024n ** 3n;

export const PANEL_USAGE_MIN_BALANCE_GB = 50;
export const PANEL_USAGE_LOW_BALANCE_GB = 10;
export const PANEL_USAGE_CRITICAL_BALANCE_GB = 5;

export const OUTBOUND_USAGE_MIN_BALANCE_GB = 50;
export const OUTBOUND_USAGE_EXISTING_RESERVE_GB = 25;
export const OUTBOUND_USAGE_LOW_BALANCE_GB = 10;
export const OUTBOUND_USAGE_CRITICAL_BALANCE_GB = 5;
export const OUTBOUND_VOLUME_ALERT_THRESHOLDS_GB = [15, 10, 5];
export const OUTBOUND_VOLUME_ALERT_RESET_GB = 15;

/** Tiered low-balance warnings: one Telegram message per tier (5→1 GB). */
export const PANEL_USAGE_WARN_TIERS_GB = [5, 4, 3, 2, 1];
export const PANEL_USAGE_WARN_RESET_GB = 5;

export function calculateUsageCostIrt(deltaBytes, pricePerGb) {
  if (deltaBytes <= 0n) return 0n;
  const price = BigInt(pricePerGb);
  return (deltaBytes * price + GB_BYTES - 1n) / GB_BYTES;
}

export function calculateTrafficBytesForCostIrt(amountIrt, pricePerGb) {
  if (amountIrt <= 0n) return 0n;
  const price = BigInt(pricePerGb);
  return (BigInt(amountIrt) * GB_BYTES) / price;
}

export function getBalanceThresholdIrt(gb, pricePerGb) {
  return BigInt(gb) * BigInt(pricePerGb);
}

export function buildPanelUsageBillingContext(pricePerGb) {
  const price = Number(pricePerGb) || 4000;
  return {
    pricePerGb: price,
    lowBalance10GbIrt: getBalanceThresholdIrt(PANEL_USAGE_LOW_BALANCE_GB, price),
    lowBalance5GbIrt: getBalanceThresholdIrt(PANEL_USAGE_CRITICAL_BALANCE_GB, price),
    reactivateMinIrt: getBalanceThresholdIrt(PANEL_USAGE_MIN_BALANCE_GB, price),
  };
}

export function getOutboundUsageRequiredBalanceGb(existingCount = 0) {
  return (
    OUTBOUND_USAGE_MIN_BALANCE_GB +
    Number(existingCount) * OUTBOUND_USAGE_EXISTING_RESERVE_GB
  );
}

export function getOutboundUsageMinimumBalanceIrt(pricePerGb, existingCount = 0) {
  const requiredGb = getOutboundUsageRequiredBalanceGb(existingCount);
  return Number(getBalanceThresholdIrt(requiredGb, pricePerGb));
}

export function buildOutboundUsageBillingContext(pricePerGb) {
  const price = Number(pricePerGb) || 4000;
  return {
    pricePerGb: price,
    lowBalance10GbIrt: getBalanceThresholdIrt(OUTBOUND_USAGE_LOW_BALANCE_GB, price),
    lowBalance5GbIrt: getBalanceThresholdIrt(OUTBOUND_USAGE_CRITICAL_BALANCE_GB, price),
    reactivateMinIrt: getBalanceThresholdIrt(OUTBOUND_USAGE_MIN_BALANCE_GB, price),
  };
}

export function toBigInt(value) {
  if (typeof value === "bigint") return value;
  if (value == null) return 0n;
  try {
    return BigInt(String(value));
  } catch {
    return 0n;
  }
}

/** If a value is a GB count (e.g. 650) instead of bytes, convert to bytes. */
export function normalizeTrafficBytes(value) {
  const bytes = toBigInt(value);
  if (bytes <= 0n) return 0n;
  if (bytes < GB_BYTES) return bytes * GB_BYTES;
  return bytes;
}

/** Rounds up to 2 decimal GB for display (matches exmplebot). */
export function formatTrafficGb(trafficBytes) {
  const bytes = toBigInt(trafficBytes);
  const gbTimes100 = (bytes * 100n + GB_BYTES - 1n) / GB_BYTES;
  const gb = Number(gbTimes100) / 100;
  return gb.toLocaleString("en-US", {
    useGrouping: false,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
