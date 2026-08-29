import { GB_BYTES } from "./outbound-usage-billing.js";

export function formatTrafficGb(trafficBytes) {
  const bytes = BigInt(trafficBytes);
  const gbTimes100 = (bytes * 100n + GB_BYTES - 1n) / GB_BYTES;
  const gb = Number(gbTimes100) / 100;

  return gb.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
