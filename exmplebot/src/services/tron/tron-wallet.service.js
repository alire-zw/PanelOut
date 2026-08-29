import { prisma } from "../../db/prisma.js";
import { logger } from "../../lib/logger.js";
import { createTronAccount } from "./tron.client.js";

export async function getOrCreateTronWallet(userId) {
  const telegramUserId = BigInt(userId);

  const existing = await prisma.tronWallet.findUnique({
    where: { userId: telegramUserId },
  });

  if (existing) {
    return existing;
  }

  const account = await createTronAccount();

  const wallet = await prisma.tronWallet.create({
    data: {
      userId: telegramUserId,
      address: account.address.base58,
      privateKey: account.privateKey,
      publicKey: account.publicKey,
    },
  });

  logger.info("tron", `wallet new ${userId}`, { address: wallet.address });

  return wallet;
}

export async function listTronWallets() {
  return prisma.tronWallet.findMany({
    orderBy: { id: "asc" },
  });
}

export async function touchWalletChecked(walletId) {
  await prisma.tronWallet.update({
    where: { id: walletId },
    data: {
      lastCheckedAt: new Date(),
      dateUpdated: new Date(),
    },
  });
}
