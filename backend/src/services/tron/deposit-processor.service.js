import { getSql } from "../../db/postgres.js";
import { invalidateWalletTransactionsCache } from "../../db/walletTransactions.js";
import { insertTronTransactionCredit } from "../../db/tronTransactions.js";
import { log } from "../../lib/logger.js";
import {
  calculateIrtFromSun,
  getTrxPriceIrt,
} from "../pricing/swapwallet.service.js";
import { notifyDepositSuccess } from "../depositNotification.service.js";
import { reactivateSuspendedPanelsAfterWalletCredit } from "../panelUsageBilling.service.js";
import { reactivateSuspendedOutboundAfterWalletCredit } from "../outboundUsageBilling.service.js";
import {
  fetchIncomingTransactions,
  parseTrxTransfer,
} from "./tron-grid.service.js";
import { sweepDepositToMaster } from "./tron-sweep.service.js";
import { touchWalletChecked } from "./tron-wallet.service.js";

async function creditDeposit(wallet, deposit, trxPriceIrt) {
  const amountIrt = calculateIrtFromSun(deposit.amountSun, trxPriceIrt);

  if (amountIrt <= 0) {
    return null;
  }

  const sql = getSql();

  try {
    const result = await sql.begin(async (tx) =>
      insertTronTransactionCredit(tx, {
        telegramUserId: wallet.userId,
        walletId: wallet.id,
        deposit,
        trxPriceIrt,
        amountIrt,
      }),
    );

    if (!result) {
      return null;
    }

    log.event("tron", `deposit +${amountIrt} irt`, {
      userId: String(wallet.userId),
      tx: deposit.txHash,
      trx: deposit.amountTrx,
    });

    await invalidateWalletTransactionsCache(wallet.userId);

    return { amountIrt, newBalance: result.newBalance };
  } catch (err) {
    if (err.code === "23505") {
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

    void reactivateSuspendedPanelsAfterWalletCredit(wallet.userId).catch((err) => {
      log.warn("billing", `reactivate after tron fail — ${err.message || err}`);
    });
    void reactivateSuspendedOutboundAfterWalletCredit(wallet.userId).catch((err) => {
      log.warn("outbound-billing", `reactivate after tron fail — ${err.message || err}`);
    });

    await sweepDepositToMaster(wallet, deposit);
  }

  await touchWalletChecked(wallet.id);

  return credited;
}

export async function processAllWalletDeposits() {
  const { listTronWallets } = await import("../../db/tronWallets.js");
  const wallets = await listTronWallets();

  let totalCredited = 0;

  for (const wallet of wallets) {
    try {
      totalCredited += await processWalletDeposits(wallet);
    } catch (err) {
      log.error("tron", `check fail ${wallet.address}`, { error: err.message });
    }
  }

  return { wallets: wallets.length, credited: totalCredited };
}
