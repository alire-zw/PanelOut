import { OUTBOUND_TB_THRESHOLD_GB } from "./outboundVolumeSteps.js";

export const OUTBOUND_VOLUME_DISCOUNT_5TB_GB = 5120;

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

export function getOutboundVolumeQuote(volumeGb, pricePerGb) {
  const gb = Math.trunc(Number(volumeGb) || 0);
  const price = Number(pricePerGb) || 4000;
  const { basePrice, discountPercent, totalPrice } = calculateOutboundVolumePrice(gb, price);

  return {
    volumeGb: gb,
    pricePerGb: price,
    baseAmountIrt: Number(basePrice),
    discountPercent,
    amountIrt: Number(totalPrice),
  };
}
