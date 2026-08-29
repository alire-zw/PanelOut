import { prisma } from "../../db/prisma.js";
import { logger } from "../../lib/logger.js";
import { notifyDepositSuccess } from "../deposit-notification.service.js";
import { handleUserWalletRecharged } from "../wallet-recharge.service.js";
import {
  calculateIrtFromSun,
  getTrxPriceIrt,
} from "../pricing/swapwallet.service.js";
import {
  fetchIncomingTransactions,
  parseTrxTransfer,
} from "./tron-grid.service.js";
import { sweepDepositToMaster } from "./tron-sweep.service.js";
import { touchWalletChecked } from "./tron-wallet.service.js";

async function creditDeposit(wallet, deposit, trxPriceIrt) {
  const amountIrt = calculateIrtFromSun(deposit.amountSun, trxPriceIrt);

  if (amountIrt <= 0n) {
    return null;
  }

  try {
    const newBalance = await prisma.$transaction(async (tx) => {
      await tx.tronTransaction.create({
        data: {
          userId: wallet.userId,
          walletId: wallet.id,
          txHash: deposit.txHash,
          fromAddress: deposit.fromAddress,
          toAddress: deposit.toAddress,
          amountSun: deposit.amountSun,
          amountTrx: deposit.amountTrx,
          trxPriceIrt,
          amountIrt,
          blockNumber: deposit.blockNumber,
          blockTimestamp: deposit.blockTimestamp,
        },
      });

      const user = await tx.user.update({
        where: { userId: wallet.userId },
        data: {
          balance: { increment: amountIrt },
          dateUpdated: new Date(),
        },
      });

      return user.balance;
    });

    logger.info("tron", `deposit +${amountIrt} irt`, {
      userId: wallet.userId.toString(),
      tx: deposit.txHash,
      trx: deposit.amountTrx,
    });

    return { amountIrt, newBalance };
  } catch (err) {
    if (err.code === "P2002") {
      return null;
    }

    throw err;
  }
}

export async function processWalletDeposits(wallet) {
  const transactions = await fetchIncomingTransactions(wallet.address);
  const trxPriceIrt = await getTrxPriceIrt();
  let credited = 0;

  for (const tx of transactions) {
    const deposit = parseTrxTransfer(tx, wallet.address);

    if (!deposit) {
      continue;
    }

    const result = await creditDeposit(wallet, deposit, trxPriceIrt);

    if (!result) {
      continue;
    }

    credited += 1;

    await notifyDepositSuccess({
      telegramUserId: wallet.userId,
      amountTrx: deposit.amountTrx,
      amountIrt: result.amountIrt,
      newBalance: result.newBalance,
      txHash: deposit.txHash,
    });

    await handleUserWalletRecharged(wallet.userId);

    await sweepDepositToMaster(wallet, deposit);
  }

  await touchWalletChecked(wallet.id);

  return credited;
}

export async function processAllWalletDeposits() {
  const wallets = await prisma.tronWallet.findMany({
    orderBy: { id: "asc" },
  });

  let totalCredited = 0;

  for (const wallet of wallets) {
    try {
      totalCredited += await processWalletDeposits(wallet);
    } catch (err) {
      logger.error("tron", `check fail ${wallet.address}`, {
        error: err.message,
      });
    }
  }

  return { wallets: wallets.length, credited: totalCredited };
}
