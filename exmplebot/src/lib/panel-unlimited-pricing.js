import {
  PANEL_UNLIMITED_PRICE_PER_SUB,
  PANEL_UNLIMITED_PRICE_PER_USER,
} from "../constants/panel-unlimited.js";
import { getPanelUnlimitedDaysPriceMultiplier } from "./panel-unlimited-days-steps.js";

export function getPanelUnlimitedDiscountPercent(count) {
  if (count >= 50) return 10;
  if (count >= 25) return 5;
  return 0;
}

export function calculatePanelUnlimitedPrice(
  count,
  pricePerSub = PANEL_UNLIMITED_PRICE_PER_SUB,
) {
  const basePrice = BigInt(count) * BigInt(pricePerSub);
  const discountPercent = getPanelUnlimitedDiscountPercent(count);

  if (discountPercent === 0) {
    return { basePrice, discountPercent, totalPrice: basePrice };
  }

  const totalPrice = (basePrice * BigInt(100 - discountPercent)) / 100n;

  return { basePrice, discountPercent, totalPrice };
}

export function calculatePanelUnlimitedUserAddon(
  count,
  maxUsers,
  pricePerUser = PANEL_UNLIMITED_PRICE_PER_USER,
) {
  return BigInt(count) * BigInt(maxUsers) * BigInt(pricePerUser);
}

export function calculatePanelUnlimitedTotalPrice(
  count,
  maxUsers,
  days,
  pricePerSub = PANEL_UNLIMITED_PRICE_PER_SUB,
  pricePerUser = PANEL_UNLIMITED_PRICE_PER_USER,
) {
  const { basePrice, discountPercent, totalPrice: subscriptionTotal } =
    calculatePanelUnlimitedPrice(count, pricePerSub);
  const userAddon = calculatePanelUnlimitedUserAddon(count, maxUsers, pricePerUser);
  const subtotal = subscriptionTotal + userAddon;
  const daysMultiplier = getPanelUnlimitedDaysPriceMultiplier(days);
  const totalPrice = subtotal * BigInt(daysMultiplier);

  return {
    basePrice,
    discountPercent,
    subscriptionTotal,
    userAddon,
    subtotal,
    daysMultiplier,
    totalPrice,
  };
}
