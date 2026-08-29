import { calculateOutboundVolumePrice } from "../lib/outbound-volume-pricing.js";
import {
  DEFAULT_OUTBOUND_VOLUME_GB,
  getNextOutboundVolumeGb,
  getPrevOutboundVolumeGb,
} from "../lib/outbound-volume-steps.js";
import { newServiceOutboundVolumeKeyboard } from "../keyboards/new-service-outbound-volume.keyboard.js";
import { buildNewServiceOutboundVolumeMessage } from "../messages/new-service-outbound-volume.message.js";
import { getSubscriptionPricing } from "./subscription-pricing.service.js";

function resolveVolumeGb(gb) {
  return gb ?? DEFAULT_OUTBOUND_VOLUME_GB;
}

async function buildScreen(selectedGb, pricePerGb) {
  const { discountPercent, totalPrice } = calculateOutboundVolumePrice(
    selectedGb,
    pricePerGb,
  );

  return {
    text: buildNewServiceOutboundVolumeMessage({
      pricePerGb,
      selectedGb,
      discountPercent,
      totalPrice,
    }),
    keyboard: newServiceOutboundVolumeKeyboard(selectedGb),
  };
}

export async function buildNewServiceOutboundVolumeScreen(
  selectedGb = DEFAULT_OUTBOUND_VOLUME_GB,
) {
  const pricing = await getSubscriptionPricing();
  return buildScreen(resolveVolumeGb(selectedGb), pricing.outboundPricePerGb);
}

export async function buildNewServiceOutboundVolumeScreenFromAction(action) {
  if (!action) {
    return buildNewServiceOutboundVolumeScreen();
  }

  if (action.action === "display") {
    return null;
  }

  const pricing = await getSubscriptionPricing();
  const pricePerGb = pricing.outboundPricePerGb;
  const currentGb = resolveVolumeGb(action.gb);

  if (action.action === "inc") {
    return buildScreen(getNextOutboundVolumeGb(currentGb), pricePerGb);
  }

  if (action.action === "dec") {
    return buildScreen(getPrevOutboundVolumeGb(currentGb), pricePerGb);
  }

  return buildScreen(currentGb, pricePerGb);
}
