import { ensureUsersTable } from "./users.js";
import { ensureBankCardsTable } from "./bankCards.js";
import { ensureCardChargesTable } from "./cardCharges.js";
import { ensureTransfersTable } from "./transfers.js";
import { ensureReceiptUploadsTable } from "./receiptUploads.js";
import { ensurePaymentSettingsTable } from "./paymentSettings.js";
import { ensureTronWalletsTable } from "./tronWallets.js";
import { ensureTronTransactionsTable } from "./tronTransactions.js";
import {
  ensureSupportTicketsTables,
  getSupportTelegramUsername,
  setSupportTelegramUsername,
} from "./supportTickets.js";
import { ensureAdminSystemChannelsTable } from "./systemChannels.js";
import { ensurePasarGuardPanelsTable } from "./pasarguardPanels.js";
import { ensureUserPanelSubscriptionsTable } from "./userPanelSubscriptions.js";
import { ensurePricingSettingsTable } from "./pricingSettings.js";
import { ensurePanelUsageChargesTable } from "./panelUsageCharges.js";
import { ensureOutboundUsageChargesTable } from "./outboundUsageCharges.js";
import { ensureAuditLogTable } from "../lib/audit.js";
import { config } from "../config.js";
import { log } from "../lib/logger.js";

export async function ensureSchema() {
  await ensureUsersTable();
  await ensureBankCardsTable();
  await ensureCardChargesTable();
  await ensureTransfersTable();
  await ensureReceiptUploadsTable();
  await ensurePaymentSettingsTable();
  await ensureTronWalletsTable();
  await ensureTronTransactionsTable();
  await ensureSupportTicketsTables();
  await ensureAdminSystemChannelsTable();
  await ensurePasarGuardPanelsTable();
  await ensureUserPanelSubscriptionsTable();
  await ensurePanelUsageChargesTable();
  await ensureOutboundUsageChargesTable();
  await ensurePricingSettingsTable();
  await ensureAuditLogTable();

  if (config.supportTelegramUsername) {
    const existing = await getSupportTelegramUsername();
    if (!existing) {
      await setSupportTelegramUsername(config.supportTelegramUsername);
    }
  }

  log.service(
    "Schema",
    "users, cards, charges, transfers, tron, support, channels, panels, billing, security",
  );
}
