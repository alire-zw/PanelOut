import { buildWalletMessage } from "../messages/wallet.message.js";
import { walletKeyboard } from "../keyboards/wallet.keyboard.js";
import { getUserByTelegramId, syncUserFromTelegram } from "./user.service.js";

export async function buildWalletScreen(from) {
  let user = await getUserByTelegramId(from.id);

  if (!user) {
    user = await syncUserFromTelegram(from);
  }

  return {
    text: buildWalletMessage(from.id, user.balance),
    keyboard: walletKeyboard(),
  };
}
