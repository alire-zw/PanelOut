import { prisma } from "../../db/prisma.js";
import { logger } from "../../lib/logger.js";
import { getMasterWalletAddress } from "../payment-settings.service.js";
import { getTronWebForPrivateKey } from "./tron.client.js";

const FEE_RESERVE_SUN = 350_000;

function resolveDepositSweepAmountSun(balanceSun, depositSun) {
  const availableSun = balanceSun - FEE_RESERVE_SUN;

  if (availableSun <= 0) {
    return 0;
  }

  return Math.min(depositSun, availableSun);
}

function resolveFullSweepAmountSun(balanceSun) {
  const amountSun = balanceSun - FEE_RESERVE_SUN;
  return amountSun > 0 ? amountSun : 0;
}

async function sendSweepTransaction(wallet, amountSun, meta = {}) {
  const masterAddress = await getMasterWalletAddress();

  if (!masterAddress) {
    logger.debug("sweep", "skip (no master)");
    return null;
  }

  if (masterAddress === wallet.address) {
    logger.warn("sweep", "skip (master is deposit wallet)", {
      address: wallet.address,
    });
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

    logger.info("sweep", `sent ${amountSun} sun`, {
      from: wallet.address,
      to: masterAddress,
      sweepTx: sweepTxHash,
      ...meta,
    });

    return { sweepTxHash, amountSun };
  } catch (err) {
    logger.error("sweep", "fail", {
      address: wallet.address,
      error: err.message,
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
    logger.warn("sweep", "skip (insufficient)", {
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

  await prisma.tronTransaction.update({
    where: { txHash: deposit.txHash },
    data: {
      sweepTxHash: result.sweepTxHash,
      sweptAt: new Date(),
    },
  });

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

  const wallets = await prisma.tronWallet.findMany({
    orderBy: { id: "asc" },
  });

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
      logger.error("sweep", `check fail ${wallet.address}`, {
        error: err.message,
      });
    }
  }

  return { wallets: wallets.length, swept, withBalance };
}
