import { OUTBOUND_TB_THRESHOLD_GB } from "./outbound-volume-steps.js";

export const OUTBOUND_VOLUME_DISCOUNT_5TB_GB = 5000;

export function getOutboundVolumeDiscountPercent(gb) {
  if (gb >= OUTBOUND_VOLUME_DISCOUNT_5TB_GB) {
    return 10;
  }

  if (gb >= OUTBOUND_TB_THRESHOLD_GB) {
    return 5;
  }

  return 0;
}

export function calculateOutboundVolumePrice(gb, pricePerGb) {
  const basePrice = BigInt(gb) * BigInt(pricePerGb);
  const discountPercent = getOutboundVolumeDiscountPercent(gb);

  if (discountPercent === 0) {
    return { basePrice, discountPercent, totalPrice: basePrice };
  }

  const totalPrice = (basePrice * BigInt(100 - discountPercent)) / 100n;

  return { basePrice, discountPercent, totalPrice };
}
