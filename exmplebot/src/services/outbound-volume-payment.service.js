import { calculateOutboundVolumePrice } from "../lib/outbound-volume-pricing.js";
import { DEFAULT_OUTBOUND_VOLUME_GB } from "../lib/outbound-volume-steps.js";
import {
  outboundVolumeCardPaymentKeyboard,
  outboundVolumeInsufficientBalanceKeyboard,
  outboundVolumePaymentKeyboard,
  outboundVolumeWalletProcessingKeyboard,
} from "../keyboards/outbound-volume-payment.keyboard.js";
import {
  buildOutboundVolumeCardDisabledMessage,
  buildOutboundVolumeCardPaymentMessage,
  buildOutboundVolumeInsufficientBalanceMessage,
  buildOutboundVolumePaymentMessage,
  buildOutboundVolumeWalletProcessingMessage,
} from "../messages/outbound-volume-payment.message.js";
import { getPaymentSettings, isRialPaymentAvailable } from "./payment-settings.service.js";
import { buildNewServiceOutboundVolumeScreen } from "./new-service-outbound-volume.service.js";
import { getSubscriptionPricing } from "./subscription-pricing.service.js";
import { getUserByTelegramId, syncUserFromTelegram } from "./user.service.js";
import { payOutboundVolumeWithWallet } from "./outbound-volume-order.service.js";
import { fulfillOutboundVolumeOrder } from "./outbound-subscription-fulfillment.service.js";
import { buildOutboundVolumeProvisionFailedMessage } from "../messages/outbound-volume-payment.message.js";
import { outboundSubscriptionDeliveryKeyboard } from "../keyboards/outbound-subscription-delivery.keyboard.js";
import {
  beginOutboundVolumeReceiptSession,
  clearUserSession,
} from "./user-session.service.js";

function resolveVolumeGb(gb) {
  return gb ?? DEFAULT_OUTBOUND_VOLUME_GB;
}

export async function getOutboundVolumeQuote(volumeGb) {
  const pricing = await getSubscriptionPricing();
  const pricePerGb = pricing.outboundPricePerGb;
  const { discountPercent, totalPrice } = calculateOutboundVolumePrice(
    volumeGb,
    pricePerGb,
  );

  return {
    volumeGb,
    pricePerGb,
    discountPercent,
    amountIrt: totalPrice,
  };
}

export async function buildOutboundVolumePaymentScreen(volumeGb = DEFAULT_OUTBOUND_VOLUME_GB) {
  const gb = resolveVolumeGb(volumeGb);
  const quote = await getOutboundVolumeQuote(gb);
  const settings = await getPaymentSettings();
  const cardEnabled = isRialPaymentAvailable(settings);

  return {
    text: buildOutboundVolumePaymentMessage({
      volumeGb: gb,
      amountIrt: quote.amountIrt,
      pricePerGb: quote.pricePerGb,
      discountPercent: quote.discountPercent,
      balance: 0n,
      cardEnabled,
    }),
    keyboard: outboundVolumePaymentKeyboard(gb, { cardEnabled }),
    awaitsPayment: true,
    quote,
  };
}

export async function buildOutboundVolumePaymentScreenForUser(from, volumeGb) {
  await syncUserFromTelegram(from);

  const user = await getUserByTelegramId(from.id);
  const gb = resolveVolumeGb(volumeGb);
  const quote = await getOutboundVolumeQuote(gb);
  const settings = await getPaymentSettings();
  const cardEnabled = isRialPaymentAvailable(settings);

  return {
    text: buildOutboundVolumePaymentMessage({
      volumeGb: gb,
      amountIrt: quote.amountIrt,
      pricePerGb: quote.pricePerGb,
      discountPercent: quote.discountPercent,
      balance: user?.balance ?? 0n,
      cardEnabled,
    }),
    keyboard: outboundVolumePaymentKeyboard(gb, { cardEnabled }),
    awaitsPayment: true,
    quote,
  };
}

export async function handleOutboundVolumeWalletPayment(from, volumeGb) {
  const gb = resolveVolumeGb(volumeGb);
  const quote = await getOutboundVolumeQuote(gb);

  await syncUserFromTelegram(from);
  const user = await getUserByTelegramId(from.id);

  if (!user || user.balance < quote.amountIrt) {
    return {
      success: false,
      text: buildOutboundVolumeInsufficientBalanceMessage({
        balance: user?.balance ?? 0n,
        amountIrt: quote.amountIrt,
      }),
      keyboard: outboundVolumeInsufficientBalanceKeyboard(gb),
    };
  }

  try {
    const { order } = await payOutboundVolumeWithWallet({
      userId: from.id,
      volumeGb: gb,
      pricePerGb: quote.pricePerGb,
      discountPercent: quote.discountPercent,
      amountIrt: quote.amountIrt,
    });

    await clearUserSession(from.id);

    try {
      const fulfillment = await fulfillOutboundVolumeOrder(order.id);

      if (fulfillment.delivery) {
        return {
          success: true,
          text: fulfillment.delivery.text,
          keyboard: fulfillment.delivery.keyboard,
        };
      }
    } catch {
      return {
        success: false,
        text: buildOutboundVolumeProvisionFailedMessage(),
        keyboard: outboundSubscriptionDeliveryKeyboard(),
      };
    }

    return {
      success: false,
      text: buildOutboundVolumeProvisionFailedMessage(),
      keyboard: outboundSubscriptionDeliveryKeyboard(),
    };
  } catch (err) {
    if (err.message === "INSUFFICIENT_BALANCE") {
      const refreshed = await getUserByTelegramId(from.id);

      return {
        success: false,
        text: buildOutboundVolumeInsufficientBalanceMessage({
          balance: refreshed?.balance ?? 0n,
          amountIrt: quote.amountIrt,
        }),
        keyboard: outboundVolumeInsufficientBalanceKeyboard(gb),
      };
    }

    throw err;
  }
}

export async function beginOutboundVolumeCardPayment(from, volumeGb, prompt) {
  const gb = resolveVolumeGb(volumeGb);
  const quote = await getOutboundVolumeQuote(gb);
  const settings = await getPaymentSettings();

  if (!isRialPaymentAvailable(settings)) {
    return {
      text: buildOutboundVolumeCardDisabledMessage(),
      keyboard: outboundVolumePaymentKeyboard(gb, { cardEnabled: false }),
    };
  }

  await beginOutboundVolumeReceiptSession(from.id, {
    volumeGb: gb,
    pricePerGb: quote.pricePerGb,
    discountPercent: quote.discountPercent,
    amountIrt: quote.amountIrt.toString(),
    promptChatId: prompt?.chatId,
    promptMessageId: prompt?.messageId,
  });

  return {
    text: buildOutboundVolumeCardPaymentMessage(settings, quote.amountIrt),
    keyboard: outboundVolumeCardPaymentKeyboard(gb),
    awaitsReceipt: true,
  };
}

export function buildOutboundVolumeWalletProcessingScreen() {
  return {
    text: buildOutboundVolumeWalletProcessingMessage(),
    keyboard: outboundVolumeWalletProcessingKeyboard(),
  };
}

export async function buildOutboundVolumePaymentBackScreen(volumeGb) {
  return buildNewServiceOutboundVolumeScreen(volumeGb);
}
