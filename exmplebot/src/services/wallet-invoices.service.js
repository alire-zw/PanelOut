import {
  USAGE_INVOICE_BATCH_SIZE,
  WALLET_INVOICES_PAGE_SIZE,
} from "../constants/wallet-invoices.js";
import { prisma } from "../db/prisma.js";
import {
  walletInvoiceDetailKeyboard,
  walletInvoicesKeyboard,
} from "../keyboards/wallet-invoices.keyboard.js";
import { buildWalletInvoiceDetailMessage } from "../messages/wallet-invoice-detail.message.js";
import { buildWalletInvoicesMessage } from "../messages/wallet-invoices.message.js";
import { formatJalaliDateTime } from "../lib/tehran-time.js";
import { syncUserFromTelegram } from "./user.service.js";

const FETCH_LIMIT = 1000;

export { USAGE_INVOICE_BATCH_SIZE, WALLET_INVOICES_PAGE_SIZE };

function sumBigInt(values, field) {
  return values.reduce((total, item) => total + BigInt(item[field]), 0n);
}

function mapUsageInvoiceBatch(charges, batchIndex) {
  const amountIrt = sumBigInt(charges, "amountIrt");
  const trafficBytes = sumBigInt(charges, "trafficBytes");
  const serviceTypes = new Set(charges.map((charge) => charge.serviceLabel));

  let invoiceServiceType = "outbound";
  if (serviceTypes.has("panel") && serviceTypes.has("outbound")) {
    invoiceServiceType = "mixed";
  } else if (serviceTypes.has("panel")) {
    invoiceServiceType = "panel";
  }

  return {
    id: String(charges[0].id),
    anchorChargeId: String(charges[0].id),
    batchIndex,
    invoiceNumber: batchIndex + 1,
    chargeCount: charges.length,
    amountIrt,
    trafficBytes,
    dateFrom: charges[0].dateCreated,
    dateTo: charges[charges.length - 1].dateCreated,
    status: "paid",
    serviceType: invoiceServiceType,
  };
}

function aggregateUsageCharges(charges) {
  const batches = [];

  for (let i = 0; i < charges.length; i += USAGE_INVOICE_BATCH_SIZE) {
    batches.push(charges.slice(i, i + USAGE_INVOICE_BATCH_SIZE));
  }

  return batches
    .map((slice, batchIndex) => mapUsageInvoiceBatch(slice, batchIndex))
    .reverse();
}

export async function getUserUsageInvoices(telegramUserId) {
  const userId = BigInt(telegramUserId);

  const [outboundCharges, panelCharges] = await Promise.all([
    prisma.outboundUsageCharge.findMany({
      where: { userId },
      orderBy: { id: "asc" },
      take: FETCH_LIMIT,
    }),
    prisma.panelUsageCharge.findMany({
      where: { userId },
      orderBy: { id: "asc" },
      take: FETCH_LIMIT,
    }),
  ]);

  const merged = [
    ...outboundCharges.map((charge) => ({ ...charge, serviceLabel: "outbound" })),
    ...panelCharges.map((charge) => ({ ...charge, serviceLabel: "panel" })),
  ].sort((a, b) => {
    const dateDiff = a.dateCreated.getTime() - b.dateCreated.getTime();
    if (dateDiff !== 0) return dateDiff;
    return Number(a.id - b.id);
  });

  return aggregateUsageCharges(merged);
}

export async function findUserUsageInvoice(telegramUserId, anchorChargeId) {
  const invoices = await getUserUsageInvoices(telegramUserId);
  return (
    invoices.find((invoice) => invoice.anchorChargeId === String(anchorChargeId)) ??
    null
  );
}

function paginateInvoices(invoices, page) {
  const totalCount = invoices.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / WALLET_INVOICES_PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const start = safePage * WALLET_INVOICES_PAGE_SIZE;

  return {
    items: invoices.slice(start, start + WALLET_INVOICES_PAGE_SIZE),
    page: safePage,
    totalPages,
    totalCount,
  };
}

export async function buildWalletInvoicesScreen(from, page = 0) {
  await syncUserFromTelegram(from);

  const invoices = await getUserUsageInvoices(from.id);
  const { items, page: safePage, totalPages, totalCount } = paginateInvoices(
    invoices,
    page,
  );
  const updatedAt = formatJalaliDateTime();

  return {
    text: buildWalletInvoicesMessage(updatedAt, totalCount > 0, {
      page: safePage,
      totalPages,
      totalCount,
    }),
    keyboard: walletInvoicesKeyboard(items, {
      page: safePage,
      totalPages,
    }),
  };
}

export async function buildWalletInvoiceDetailScreen(from, anchorChargeId, listPage = 0) {
  await syncUserFromTelegram(from);

  const invoice = await findUserUsageInvoice(from.id, anchorChargeId);

  if (!invoice) {
    return buildWalletInvoicesScreen(from, listPage);
  }

  const updatedAt = formatJalaliDateTime();

  return {
    text: buildWalletInvoiceDetailMessage(invoice, updatedAt),
    keyboard: walletInvoiceDetailKeyboard(invoice, listPage),
  };
}
