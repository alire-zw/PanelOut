import { GB_BYTES } from "./outbound-usage-billing.js";

export function getPanelUserRemainingBytes(panelUser) {
  const dataLimit = BigInt(panelUser?.data_limit ?? 0);

  if (dataLimit <= 0n) {
    return null;
  }

  const used = BigInt(panelUser?.used_traffic ?? 0);
  const remaining = dataLimit - used;

  return remaining > 0n ? remaining : 0n;
}

export function isRemainingAtOrBelowGb(remainingBytes, thresholdGb) {
  return remainingBytes <= BigInt(thresholdGb) * GB_BYTES;
}
