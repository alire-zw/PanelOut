import { ensureUsersTable } from "./users.js";
import { ensureBankCardsTable } from "./bankCards.js";
import { ensureCardChargesTable } from "./cardCharges.js";
import { ensureTransfersTable } from "./transfers.js";
import { ensureReceiptUploadsTable } from "./receiptUploads.js";
import {
  ensureSupportTicketsTables,
  getSupportTelegramUsername,
  setSupportTelegramUsername,
} from "./supportTickets.js";
import { ensureAdminSystemChannelsTable } from "./systemChannels.js";
import { ensureAuditLogTable } from "../lib/audit.js";
import { config } from "../config.js";
import { log } from "../lib/logger.js";

export async function ensureSchema() {
  await ensureUsersTable();
  await ensureBankCardsTable();
  await ensureCardChargesTable();
  await ensureTransfersTable();
  await ensureReceiptUploadsTable();
  await ensureSupportTicketsTables();
  await ensureAdminSystemChannelsTable();
  await ensureAuditLogTable();

  if (config.supportTelegramUsername) {
    const existing = await getSupportTelegramUsername();
    if (!existing) {
      await setSupportTelegramUsername(config.supportTelegramUsername);
    }
  }

  log.service(
    "Schema",
    "users, cards, charges, transfers, support, channels, security",
  );
}
