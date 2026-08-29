import { createTronAccount } from "./tron.client.js";
import {
  createTronWallet,
  findTronWalletByUserId,
  touchTronWalletChecked,
} from "../../db/tronWallets.js";
import { log } from "../../lib/logger.js";

export async function getOrCreateTronWallet(telegramUserId) {
  const existing = await findTronWalletByUserId(telegramUserId);

  if (existing) {
    return existing;
  }

  const account = await createTronAccount();

  const wallet = await createTronWallet({
    telegramUserId,
    address: account.address.base58,
    privateKey: account.privateKey,
    publicKey: account.publicKey,
  });

  log.event("tron", `wallet new tg:${telegramUserId} ${wallet.address}`);

  return wallet;
}

export { touchTronWalletChecked as touchWalletChecked };
export { listTronWallets } from "../../db/tronWallets.js";
