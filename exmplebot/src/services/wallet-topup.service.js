import { walletTopUpMethodKeyboard } from "../keyboards/wallet-topup-method.keyboard.js";
import { walletRialTopUpKeyboard } from "../keyboards/wallet-rial-topup.keyboard.js";
import { walletTopUpKeyboard } from "../keyboards/wallet-topup.keyboard.js";
import {
  buildWalletRialTopUpMessage,
  walletRialAmountPromptMessage,
} from "../messages/wallet-rial-topup.message.js";
import {
  walletTopUpMethodMessage,
  walletTopUpUnavailableMessage,
} from "../messages/wallet-topup-method.message.js";
import { buildWalletTopUpMessage } from "../messages/wallet-topup.message.js";
import { getTrxPriceIrt } from "./pricing/swapwallet.service.js";
import {
  getPaymentSettings,
  isRialPaymentAvailable,
  isTronPaymentAvailable,
} from "./payment-settings.service.js";
import { getOrCreateTronWallet } from "./tron/tron-wallet.service.js";
import { syncUserFromTelegram } from "./user.service.js";
import {
  setUserSession,
  UserSessionAction,
} from "./user-session.service.js";

export async function buildWalletTopUpMethodScreen(from) {
  await syncUserFromTelegram(from);

  const settings = await getPaymentSettings();
  const tron = isTronPaymentAvailable(settings);
  const rial = isRialPaymentAvailable(settings);

  if (tron && !rial) {
    return buildWalletTronTopUpScreen(from);
  }

  if (rial && !tron) {
    return buildWalletRialAmountPromptScreen(from);
  }

  if (!tron && !rial) {
    return {
      text: walletTopUpUnavailableMessage,
      keyboard: walletTopUpKeyboard(),
    };
  }

  return {
    text: walletTopUpMethodMessage,
    keyboard: walletTopUpMethodKeyboard({ tron, rial }),
  };
}

export async function buildWalletTronTopUpScreen(from) {
  await syncUserFromTelegram(from);

  const settings = await getPaymentSettings();

  if (!isTronPaymentAvailable(settings)) {
    return {
      text: walletTopUpUnavailableMessage,
      keyboard: walletTopUpKeyboard(),
    };
  }

  const [wallet, trxPriceIrt] = await Promise.all([
    getOrCreateTronWallet(from.id),
    getTrxPriceIrt(),
  ]);

  return {
    text: buildWalletTopUpMessage(wallet.address, trxPriceIrt),
    keyboard: walletTopUpKeyboard(),
  };
}

export async function buildWalletRialAmountPromptScreen(from) {
  await syncUserFromTelegram(from);

  const settings = await getPaymentSettings();

  if (!isRialPaymentAvailable(settings)) {
    return {
      text: walletTopUpUnavailableMessage,
      keyboard: walletTopUpKeyboard(),
    };
  }

  return {
    text: walletRialAmountPromptMessage,
    keyboard: walletRialTopUpKeyboard(),
    awaitsTextInput: true,
  };
}

export async function buildWalletRialTopUpScreen(from, amountIrt) {
  await syncUserFromTelegram(from);

  const settings = await getPaymentSettings();

  if (!isRialPaymentAvailable(settings)) {
    return {
      text: walletTopUpUnavailableMessage,
      keyboard: walletTopUpKeyboard(),
    };
  }

  await setUserSession(from.id, {
    action: UserSessionAction.AWAITING_RIAL_RECEIPT,
    amountIrt: amountIrt.toString(),
  });

  return {
    text: buildWalletRialTopUpMessage(settings, amountIrt),
    keyboard: walletRialTopUpKeyboard(),
    awaitsReceipt: true,
  };
}
