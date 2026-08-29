export const GB_BYTES = 1024n ** 3n;

export function calculateUsageCostIrt(deltaBytes, pricePerGb) {
  if (deltaBytes <= 0n) {
    return 0n;
  }

  const price = BigInt(pricePerGb);
  return (deltaBytes * price + GB_BYTES - 1n) / GB_BYTES;
}

export function calculateTrafficBytesForCostIrt(amountIrt, pricePerGb) {
  if (amountIrt <= 0n) {
    return 0n;
  }

  const price = BigInt(pricePerGb);
  return (BigInt(amountIrt) * GB_BYTES) / price;
}

export function getBalanceThresholdIrt(gb, pricePerGb) {
  return BigInt(gb) * BigInt(pricePerGb);
}
