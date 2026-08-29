import { getMasterWalletAddress } from "../../db/paymentSettings.js";
import { markTronTransactionSwept } from "../../db/tronTransactions.js";
import { log } from "../../lib/logger.js";
import { getTronWebForPrivateKey } from "./tron.client.js";

const FEE_RESERVE_SUN = 350_000;

function resolveDepositSweepAmountSun(balanceSun, depositSun) {
  const availableSun = balanceSun - FEE_RESERVE_SUN;
  if (availableSun <= 0) return 0;
  return Math.min(depositSun, availableSun);
}

function resolveFullSweepAmountSun(balanceSun) {
  const amountSun = balanceSun - FEE_RESERVE_SUN;
  return amountSun > 0 ? amountSun : 0;
}

async function sendSweepTransaction(wallet, amountSun, meta = {}) {
  const masterAddress = await getMasterWalletAddress();

  if (!masterAddress) {
    log.debug("sweep", "skip (no master)");
    return null;
  }

  if (masterAddress === wallet.address) {
    log.warn("sweep", "skip (master is deposit wallet)", { address: wallet.address });
    return null;
  }

  if (amountSun <= 0) {
    return null;
  }

  const tronWeb = getTronWebForPrivateKey(wallet.privateKey);

  try {
    const result = await tronWeb.trx.sendTransaction(masterAddress, amountSun);
    const sweepTxHash = result.txid || result.transaction?.txID;

    if (!sweepTxHash) {
      throw new Error("missing sweep tx id");
    }

    log.event("sweep", `sent ${amountSun} sun → ${masterAddress}`, {
      from: wallet.address,
      sweepTx: sweepTxHash,
      ...meta,
    });

    return { sweepTxHash, amountSun };
  } catch (err) {
    log.error("sweep", err.message || err, {
      address: wallet.address,
      ...meta,
    });
    return null;
  }
}

export async function sweepDepositToMaster(wallet, deposit) {
  const tronWeb = getTronWebForPrivateKey(wallet.privateKey);
  const balanceSun = await tronWeb.trx.getBalance(wallet.address);
  const depositSun = Number(deposit.amountSun);
  const amountSun = resolveDepositSweepAmountSun(balanceSun, depositSun);

  if (amountSun <= 0) {
    log.warn("sweep", "skip (insufficient)", {
      address: wallet.address,
      balance: balanceSun,
      deposit: depositSun,
    });
    return null;
  }

  const result = await sendSweepTransaction(wallet, amountSun, {
    depositTx: deposit.txHash,
    mode: "deposit",
  });

  if (!result) {
    return null;
  }

  await markTronTransactionSwept(deposit.txHash, result.sweepTxHash);
  return result;
}

export async function sweepWalletFullBalance(wallet) {
  const tronWeb = getTronWebForPrivateKey(wallet.privateKey);
  const balanceSun = await tronWeb.trx.getBalance(wallet.address);
  const amountSun = resolveFullSweepAmountSun(balanceSun);

  if (amountSun <= 0) {
    return null;
  }

  return sendSweepTransaction(wallet, amountSun, { mode: "full" });
}

export async function sweepAllWalletBalances() {
  const masterAddress = await getMasterWalletAddress();

  if (!masterAddress) {
    return { wallets: 0, swept: 0, withBalance: 0 };
  }

  const { listTronWallets } = await import("../../db/tronWallets.js");
  const wallets = await listTronWallets();

  let swept = 0;
  let withBalance = 0;

  for (const wallet of wallets) {
    try {
      const tronWeb = getTronWebForPrivateKey(wallet.privateKey);
      const balanceSun = await tronWeb.trx.getBalance(wallet.address);

      if (balanceSun <= FEE_RESERVE_SUN) {
        continue;
      }

      withBalance += 1;

      const result = await sweepWalletFullBalance(wallet);

      if (result) {
        swept += 1;
      }
    } catch (err) {
      log.error("sweep", `check fail ${wallet.address}`, { error: err.message });
    }
  }

  return { wallets: wallets.length, swept, withBalance };
}
