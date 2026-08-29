import { prisma } from "../db/prisma.js";
import {
  walletTransactionDetailKeyboard,
  walletTransactionsKeyboard,
} from "../keyboards/wallet-transactions.keyboard.js";
import { buildWalletTransactionDetailMessage } from "../messages/wallet-transaction-detail.message.js";
import { buildWalletTransactionsMessage } from "../messages/wallet-transactions.message.js";
import { formatJalaliDateTime } from "../lib/tehran-time.js";
import { syncUserFromTelegram } from "./user.service.js";

const FETCH_LIMIT = 50;
export const WALLET_TRANSACTIONS_PAGE_SIZE = 5;

function mapTronTransaction(tx) {
  return {
    id: String(tx.id),
    type: "tron",
    amountIrt: tx.amountIrt,
    amountTrx: tx.amountTrx,
    trxPriceIrt: tx.trxPriceIrt,
    txHash: tx.txHash,
    date: tx.blockTimestamp ?? tx.dateCreated,
    status: "approved",
  };
}

function mapRialDeposit(deposit) {
  return {
    id: String(deposit.id),
    type: "rial",
    amountIrt: deposit.amountIrt,
    receiptType: deposit.receiptType,
    reviewedAt: deposit.reviewedAt,
    date: deposit.reviewedAt ?? deposit.dateCreated,
    status: deposit.status,
  };
}

export async function getUserWalletTransactions(telegramUserId) {
  const userId = BigInt(telegramUserId);

  const [tronTxs, rialDeposits] = await Promise.all([
    prisma.tronTransaction.findMany({
      where: { userId },
      orderBy: { dateCreated: "desc" },
      take: FETCH_LIMIT,
    }),
    prisma.rialDeposit.findMany({
      where: { userId },
      orderBy: { dateCreated: "desc" },
      take: FETCH_LIMIT,
    }),
  ]);

  return [
    ...tronTxs.map(mapTronTransaction),
    ...rialDeposits.map(mapRialDeposit),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function findUserWalletTransaction(telegramUserId, type, id) {
  const userId = BigInt(telegramUserId);

  if (type === "tron") {
    const tx = await prisma.tronTransaction.findFirst({
      where: { id: BigInt(id), userId },
    });

    return tx ? mapTronTransaction(tx) : null;
  }

  if (type === "rial") {
    const deposit = await prisma.rialDeposit.findFirst({
      where: { id: BigInt(id), userId },
    });

    return deposit ? mapRialDeposit(deposit) : null;
  }

  return null;
}

function paginateTransactions(transactions, page) {
  const totalCount = transactions.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / WALLET_TRANSACTIONS_PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const start = safePage * WALLET_TRANSACTIONS_PAGE_SIZE;

  return {
    items: transactions.slice(start, start + WALLET_TRANSACTIONS_PAGE_SIZE),
    page: safePage,
    totalPages,
    totalCount,
  };
}

export async function buildWalletTransactionsScreen(from, page = 0) {
  await syncUserFromTelegram(from);

  const transactions = await getUserWalletTransactions(from.id);
  const { items, page: safePage, totalPages, totalCount } = paginateTransactions(
    transactions,
    page,
  );
  const updatedAt = formatJalaliDateTime();

  return {
    text: buildWalletTransactionsMessage(updatedAt, totalCount > 0, {
      page: safePage,
      totalPages,
      totalCount,
    }),
    keyboard: walletTransactionsKeyboard(items, {
      page: safePage,
      totalPages,
    }),
  };
}

export async function buildWalletTransactionDetailScreen(from, type, id, listPage = 0) {
  await syncUserFromTelegram(from);

  const tx = await findUserWalletTransaction(from.id, type, id);

  if (!tx) {
    return buildWalletTransactionsScreen(from, listPage);
  }

  const updatedAt = formatJalaliDateTime();

  return {
    text: buildWalletTransactionDetailMessage(tx, updatedAt),
    keyboard: walletTransactionDetailKeyboard(tx, listPage),
  };
}
