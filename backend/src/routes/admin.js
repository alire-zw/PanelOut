import { loadAdminUser } from "../lib/auth.js";
import { getSql } from "../db/postgres.js";
import {
  createBankCard,
  updateBankCard,
  deleteBankCard,
} from "../db/bankCards.js";
import {
  getBankCardsCached,
  invalidateBankCardsCache,
  syncBankCardsCached,
} from "../db/bankCardsCache.js";
import {
  approveCardCharge,
  rejectCardCharge,
} from "../db/cardCharges.js";
import {
  getAdminCharges,
  invalidateAdminChargesCache,
  syncAdminCharges,
} from "../db/adminChargesCache.js";
import { invalidateWalletTransactionsCache } from "../db/walletTransactions.js";
import { getAdminOverview } from "../services/adminOverview.service.js";
import { getAdminCombinedUsageInvoices } from "../services/adminUsageInvoices.service.js";
import {
  listUsersAdmin,
  findUserByTelegramId,
  toPublicUser,
} from "../db/users.js";
import {
  adminSetUserBalance,
  adminSetUserBanned,
  adminSetUserPanelStatus,
  adminSetUserRole,
  getAdminUserDetail,
} from "../services/adminUserManagement.service.js";
import {
  getAdminSupportTicket,
  getSupportContactSettings,
  listAdminSupportTickets,
  replyAdminSupportTicket,
  setSupportTelegramEnabled,
  setSupportTelegramUsername,
} from "../db/supportTickets.js";
import {
  AdminSystemChannelError,
  deactivateAdminSystemChannel,
  deleteAdminSystemChannel,
  getAdminSystemChannelsBotInfo,
  listAdminSystemChannels,
  registerAdminSystemChannel,
  setAdminSystemChannelActive,
} from "../db/systemChannels.js";
import {
  PasarGuardPanelError,
  createPasarGuardPanel,
  deletePasarGuardPanel,
  getPasarGuardPanelDetail,
  listPasarGuardPanels,
  reorderPasarGuardPanels,
  testPasarGuardPanelConnection,
  togglePasarGuardPanelFlag,
  updatePasarGuardPanel,
} from "../db/pasarguardPanels.js";
import {
  getPaymentSettings,
  updatePaymentSettings,
} from "../db/paymentSettings.js";
import {
  getPricingSettings,
  updatePricingSettings,
} from "../db/pricingSettings.js";
import { config } from "../config.js";
import { readJsonBody } from "../http/body.js";
import { sendJson } from "../http/respond.js";
import { writeAdminAudit } from "../lib/audit.js";
import { attachSignedReceiptUrl } from "../lib/signedUploads.js";
import { log } from "../lib/logger.js";

function sendRouteError(res, error, req, path) {
  const status = error.status || 500;
  const where = req && path ? `${req.method} ${path}  ` : "";
  if (status === 401 || status === 403) {
    log.warn("api", `${where}${status === 403 ? error.message || "Forbidden" : "Unauthorized"}`);
    sendJson(res, status === 403 ? 403 : 401, {
      ok: false,
      error: status === 403 ? error.message || "Forbidden" : "Unauthorized",
    });
    return;
  }
  if (status === 429) {
    log.warn("api", `${where}Too many requests`);
    sendJson(
      res,
      429,
      { ok: false, error: "Too many requests" },
      { "retry-after": String(error.retryAfterSec || 60) },
    );
    return;
  }
  if (status >= 500) log.error("api", `${where}${error.stack || error.message || error}`);
  else log.warn("api", `${where}${error.message || "request failed"}`);
  const payload = { ok: false, error: error.message || "Request failed" };
  if (error.name === "AdminSystemChannelError" && error.code) {
    payload.code = error.code;
  }
  if (error.name === "PasarGuardPanelError" && error.code) {
    payload.code = error.code;
  }
  sendJson(res, status, payload);
}

function parseId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

export async function handleAdminRoutes(req, res, path) {
  if (!path.startsWith("/api/admin")) return false;

  try {
    if (req.method === "GET" && path === "/api/admin/overview") {
      await loadAdminUser(req);
      sendJson(res, 200, {
        ok: true,
        overview: await getAdminOverview(),
      });
      return true;
    }

    if (req.method === "GET" && path.startsWith("/api/admin/usage-invoices")) {
      await loadAdminUser(req);
      const url = new URL(req.url || "/", "http://localhost");
      const range = url.searchParams.get("range") || "week";
      const allowedRanges = new Set(["today", "week", "month", "all"]);
      const payload = await getAdminCombinedUsageInvoices({
        range: allowedRanges.has(range) ? range : "week",
        limit: url.searchParams.get("limit"),
        offset: url.searchParams.get("offset"),
      });
      sendJson(res, 200, { ok: true, ...payload });
      return true;
    }

    if (req.method === "GET" && path === "/api/admin/payment-settings") {
      await loadAdminUser(req);
      const settings = await getPaymentSettings();
      sendJson(res, 200, {
        ok: true,
        settings: {
          ...settings,
          tronConfigured: config.tronConfigured,
        },
      });
      return true;
    }

    if (req.method === "GET" && path === "/api/admin/pricing-settings") {
      await loadAdminUser(req);
      const pricing = await getPricingSettings();
      sendJson(res, 200, {
        ok: true,
        pricing,
      });
      return true;
    }

    if (
      (req.method === "PATCH" || req.method === "PUT") &&
      path === "/api/admin/pricing-settings"
    ) {
      const { user, telegramUser } = await loadAdminUser(req, { write: true });
      const body = await readJsonBody(req);
      const pricing = await updatePricingSettings(body, telegramUser.id);
      await writeAdminAudit({
        req,
        actor: user,
        action: "pricing_settings.update",
        targetType: "pricing_settings",
        targetId: "1",
        meta: pricing,
      });
      log.event("api", `PATCH /api/admin/pricing-settings tg:${telegramUser.id}`);
      sendJson(res, 200, {
        ok: true,
        pricing,
      });
      return true;
    }

    if (req.method === "PATCH" && path === "/api/admin/payment-settings") {
      const { user, telegramUser } = await loadAdminUser(req, { write: true });
      const body = await readJsonBody(req);
      const settings = await updatePaymentSettings(telegramUser.id, {
        tronEnabled: body.tronEnabled,
        masterWalletAddress: body.masterWalletAddress,
      });
      await writeAdminAudit({
        req,
        actor: user,
        action: "payment_settings.update",
        targetType: "payment_settings",
        targetId: "1",
        meta: {
          tronEnabled: settings.tronEnabled,
          hasMasterWallet: Boolean(settings.masterWalletAddress),
        },
      });
      log.event("api", `PATCH /api/admin/payment-settings tg:${telegramUser.id}`);
      sendJson(res, 200, {
        ok: true,
        settings: {
          ...settings,
          tronConfigured: config.tronConfigured,
        },
      });
      return true;
    }

    if (req.method === "GET" && path === "/api/admin/users") {
      await loadAdminUser(req);
      const url = new URL(req.url || "/", "http://localhost");
      const users = await listUsersAdmin({
        query: url.searchParams.get("q") || "",
        limit: Number(url.searchParams.get("limit") || 50),
      });
      sendJson(res, 200, { ok: true, users });
      return true;
    }

    const userMatch = path.match(/^\/api\/admin\/users\/(\d+)$/);
    const userDetailMatch = path.match(/^\/api\/admin\/users\/(\d+)\/detail$/);
    const userBanMatch = path.match(/^\/api\/admin\/users\/(\d+)\/ban$/);
    const userBalanceMatch = path.match(/^\/api\/admin\/users\/(\d+)\/balance$/);
    const userRoleMatch = path.match(/^\/api\/admin\/users\/(\d+)\/role$/);
    const userPanelMatch = path.match(
      /^\/api\/admin\/users\/(\d+)\/panels\/(\d+)$/,
    );

    if (req.method === "GET" && userDetailMatch) {
      await loadAdminUser(req);
      const telegramId = parseId(userDetailMatch[1]);
      if (!telegramId) {
        sendJson(res, 400, { ok: false, error: "شناسه کاربر نامعتبر است" });
        return true;
      }
      const detail = await getAdminUserDetail(telegramId);
      sendJson(res, 200, { ok: true, ...detail });
      return true;
    }

    if (req.method === "PATCH" && userBanMatch) {
      const { user, telegramUser } = await loadAdminUser(req, { write: true });
      const telegramId = parseId(userBanMatch[1]);
      if (!telegramId) {
        sendJson(res, 400, { ok: false, error: "شناسه کاربر نامعتبر است" });
        return true;
      }
      const body = await readJsonBody(req);
      const result = await adminSetUserBanned(user, telegramId, Boolean(body.isBanned));
      await writeAdminAudit({
        req,
        actor: user,
        action: result.user.isBanned ? "user.ban" : "user.unban",
        targetType: "user",
        targetId: telegramId,
        meta: {
          targetUserTelegramId: String(telegramId),
          previousBanned: result.previousBanned,
          isBanned: result.user.isBanned,
        },
      });
      log.event(
        "api",
        `PATCH /api/admin/users/${telegramId}/ban banned:${result.user.isBanned} by:${telegramUser.id}`,
      );
      sendJson(res, 200, { ok: true, user: result.user });
      return true;
    }

    if (req.method === "PATCH" && userBalanceMatch) {
      const { user, telegramUser } = await loadAdminUser(req, { write: true });
      const telegramId = parseId(userBalanceMatch[1]);
      if (!telegramId) {
        sendJson(res, 400, { ok: false, error: "شناسه کاربر نامعتبر است" });
        return true;
      }
      const body = await readJsonBody(req);
      const result = await adminSetUserBalance(
        user,
        telegramId,
        body.balanceToman,
        body.note,
      );
      await invalidateWalletTransactionsCache(telegramId);
      await writeAdminAudit({
        req,
        actor: user,
        action: "user.balance.set",
        targetType: "user",
        targetId: telegramId,
        meta: {
          targetUserTelegramId: String(telegramId),
          previousBalance: result.previousBalance,
          newBalance: result.newBalance,
          note: result.note,
        },
      });
      log.event(
        "api",
        `PATCH /api/admin/users/${telegramId}/balance ${result.previousBalance}->${result.newBalance} by:${telegramUser.id}`,
      );
      sendJson(res, 200, {
        ok: true,
        user: result.user,
        previousBalance: result.previousBalance,
        newBalance: result.newBalance,
      });
      return true;
    }

    if (req.method === "PATCH" && userRoleMatch) {
      const { user, telegramUser } = await loadAdminUser(req, {
        write: true,
        supervisorOnly: true,
      });
      const telegramId = parseId(userRoleMatch[1]);
      if (!telegramId) {
        sendJson(res, 400, { ok: false, error: "شناسه کاربر نامعتبر است" });
        return true;
      }
      const body = await readJsonBody(req);
      const result = await adminSetUserRole(user, telegramId, body.role);
      await writeAdminAudit({
        req,
        actor: user,
        action: "user.role.set",
        targetType: "user",
        targetId: telegramId,
        meta: {
          targetUserTelegramId: String(telegramId),
          previousRole: result.previousRole,
          newRole: result.newRole,
        },
      });
      log.event(
        "api",
        `PATCH /api/admin/users/${telegramId}/role ${result.previousRole}->${result.newRole} by:${telegramUser.id}`,
      );
      sendJson(res, 200, {
        ok: true,
        user: result.user,
        previousRole: result.previousRole,
        newRole: result.newRole,
      });
      return true;
    }

    if (req.method === "PATCH" && userPanelMatch) {
      const { user, telegramUser } = await loadAdminUser(req, { write: true });
      const telegramId = parseId(userPanelMatch[1]);
      const subscriptionId = parseId(userPanelMatch[2]);
      if (!telegramId || !subscriptionId) {
        sendJson(res, 400, { ok: false, error: "شناسه نامعتبر است" });
        return true;
      }
      const body = await readJsonBody(req);
      const result = await adminSetUserPanelStatus(
        user,
        telegramId,
        subscriptionId,
        body.status,
      );
      await writeAdminAudit({
        req,
        actor: user,
        action: "user.panel.status",
        targetType: "user_panel",
        targetId: subscriptionId,
        meta: {
          targetUserTelegramId: String(telegramId),
          subscriptionId: String(subscriptionId),
          clientUsername: result.panel.clientUsername,
          serviceType: result.panel.serviceType,
          previousStatus: result.previousStatus,
          newStatus: result.newStatus,
        },
      });
      log.event(
        "api",
        `PATCH /api/admin/users/${telegramId}/panels/${subscriptionId} ${result.previousStatus}->${result.newStatus} by:${telegramUser.id}`,
      );
      sendJson(res, 200, { ok: true, panel: result.panel });
      return true;
    }

    if (req.method === "GET" && userMatch) {
      await loadAdminUser(req);
      const telegramId = parseId(userMatch[1]);
      if (!telegramId) {
        sendJson(res, 400, { ok: false, error: "شناسه کاربر نامعتبر است" });
        return true;
      }
      const row = await findUserByTelegramId(telegramId);
      if (!row) {
        sendJson(res, 404, { ok: false, error: "کاربر یافت نشد" });
        return true;
      }
      sendJson(res, 200, { ok: true, user: toPublicUser(row) });
      return true;
    }

    if (req.method === "GET" && path === "/api/admin/cards") {
      await loadAdminUser(req);
      const payload = await getBankCardsCached("all");
      log.event("api", `GET /api/admin/cards count:${payload.cards.length}`);
      sendJson(res, 200, { ok: true, ...payload });
      return true;
    }

    if (req.method === "GET" && path === "/api/admin/cards/sync") {
      await loadAdminUser(req);
      const url = new URL(req.url || "/", "http://localhost");
      const version = url.searchParams.get("version") || "";
      const result = await syncBankCardsCached("all", version);
      log.event("api", `GET /api/admin/cards/sync changed:${result.changed}`);
      sendJson(res, 200, { ok: true, ...result });
      return true;
    }

    if (req.method === "POST" && path === "/api/admin/cards") {
      const { user, telegramUser } = await loadAdminUser(req, { write: true });
      const body = await readJsonBody(req);
      const card = await createBankCard({
        cardNumber: body.cardNumber,
        sheba: body.sheba,
        holderName: body.holderName,
      });
      await invalidateBankCardsCache();
      await writeAdminAudit({
        req,
        actor: user,
        action: "card.create",
        targetType: "bank_card",
        targetId: card.id,
      });
      log.event("api", `POST /api/admin/cards #${card.id} by:${telegramUser.id}`);
      sendJson(res, 201, { ok: true, card });
      return true;
    }

    const cardMatch = path.match(/^\/api\/admin\/cards\/(\d+)$/);
    if (cardMatch) {
      const id = parseId(cardMatch[1]);
      if (!id) {
        sendJson(res, 400, { ok: false, error: "شناسه کارت نامعتبر است" });
        return true;
      }

      if (req.method === "PATCH") {
        const { user, telegramUser } = await loadAdminUser(req, { write: true });
        const body = await readJsonBody(req);
        const patch = {};
        if (Object.prototype.hasOwnProperty.call(body, "cardNumber")) {
          patch.cardNumber = body.cardNumber;
        }
        if (Object.prototype.hasOwnProperty.call(body, "sheba")) {
          patch.sheba = body.sheba;
        }
        if (Object.prototype.hasOwnProperty.call(body, "holderName")) {
          patch.holderName = body.holderName;
        }
        if (Object.prototype.hasOwnProperty.call(body, "isActive")) {
          patch.isActive = body.isActive;
        }
        const card = await updateBankCard(id, patch);
        await invalidateBankCardsCache();
        await writeAdminAudit({
          req,
          actor: user,
          action: "card.update",
          targetType: "bank_card",
          targetId: id,
          meta: patch,
        });
        log.event("api", `PATCH /api/admin/cards/${id} by:${telegramUser.id}`);
        sendJson(res, 200, { ok: true, card });
        return true;
      }

      if (req.method === "DELETE") {
        const { user, telegramUser } = await loadAdminUser(req, { write: true });
        const card = await deleteBankCard(id);
        await invalidateBankCardsCache();
        await writeAdminAudit({
          req,
          actor: user,
          action: "card.delete",
          targetType: "bank_card",
          targetId: id,
        });
        log.event("api", `DELETE /api/admin/cards/${id} by:${telegramUser.id}`);
        sendJson(res, 200, { ok: true, card });
        return true;
      }
    }

    if (req.method === "GET" && path === "/api/admin/charges") {
      const { telegramUser } = await loadAdminUser(req);
      const url = new URL(req.url || "/", "http://localhost");
      const status = url.searchParams.get("status") || "pending";
      const payload = await getAdminCharges(status);
      log.event(
        "api",
        `GET /api/admin/charges status:${payload.status} count:${payload.charges.length}`,
      );
      sendJson(res, 200, {
        ok: true,
        ...payload,
        charges: payload.charges.map((c) =>
          attachSignedReceiptUrl(c, telegramUser.id),
        ),
      });
      return true;
    }

    if (req.method === "GET" && path === "/api/admin/charges/sync") {
      const { telegramUser } = await loadAdminUser(req);
      const url = new URL(req.url || "/", "http://localhost");
      const status = url.searchParams.get("status") || "pending";
      const version = url.searchParams.get("version") || "";
      const result = await syncAdminCharges(status, version);
      log.event(
        "api",
        `GET /api/admin/charges/sync status:${status} changed:${result.changed}`,
      );
      sendJson(res, 200, {
        ok: true,
        ...result,
        charges: Array.isArray(result.charges)
          ? result.charges.map((c) => attachSignedReceiptUrl(c, telegramUser.id))
          : result.charges,
      });
      return true;
    }

    const approveMatch = path.match(/^\/api\/admin\/charges\/(\d+)\/approve$/);
    if (req.method === "POST" && approveMatch) {
      const { telegramUser, user } = await loadAdminUser(req);
      const id = parseId(approveMatch[1]);
      if (!id) {
        sendJson(res, 400, { ok: false, error: "شناسه درخواست نامعتبر است" });
        return true;
      }
      const charge = await approveCardCharge(id, telegramUser.id);
      await invalidateWalletTransactionsCache(charge.telegramUserId);
      await invalidateAdminChargesCache();
      await writeAdminAudit({
        req,
        actor: user,
        action: "charge.approve",
        targetType: "card_charge",
        targetId: id,
        meta: { amountToman: charge.amountToman, user: charge.telegramUserId },
      });
      log.event("api", `POST /api/admin/charges/${id}/approve by:${telegramUser.id}`);

      void import("../services/panelUsageBilling.service.js")
        .then(({ reactivateSuspendedPanelsAfterWalletCredit }) =>
          reactivateSuspendedPanelsAfterWalletCredit(charge.telegramUserId),
        )
        .catch(() => {});
      void import("../services/outboundUsageBilling.service.js")
        .then(({ reactivateSuspendedOutboundAfterWalletCredit }) =>
          reactivateSuspendedOutboundAfterWalletCredit(charge.telegramUserId),
        )
        .catch(() => {});

      sendJson(res, 200, {
        ok: true,
        charge: attachSignedReceiptUrl(charge, telegramUser.id),
      });
      return true;
    }

    const rejectMatch = path.match(/^\/api\/admin\/charges\/(\d+)\/reject$/);
    if (req.method === "POST" && rejectMatch) {
      const { telegramUser, user } = await loadAdminUser(req);
      const id = parseId(rejectMatch[1]);
      if (!id) {
        sendJson(res, 400, { ok: false, error: "شناسه درخواست نامعتبر است" });
        return true;
      }
      const body = await readJsonBody(req);
      const charge = await rejectCardCharge(id, telegramUser.id, body.note);
      await invalidateWalletTransactionsCache(charge.telegramUserId);
      await invalidateAdminChargesCache();
      await writeAdminAudit({
        req,
        actor: user,
        action: "charge.reject",
        targetType: "card_charge",
        targetId: id,
      });
      log.event("api", `POST /api/admin/charges/${id}/reject by:${telegramUser.id}`);
      sendJson(res, 200, {
        ok: true,
        charge: attachSignedReceiptUrl(charge, telegramUser.id),
      });
      return true;
    }

    if (req.method === "GET" && path === "/api/admin/tickets") {
      await loadAdminUser(req);
      const url = new URL(req.url || "/", "http://localhost");
      const payload = await listAdminSupportTickets({
        page: Number(url.searchParams.get("page") || 1),
        limit: Number(url.searchParams.get("limit") || 20),
        status: url.searchParams.get("status") || undefined,
        category: url.searchParams.get("category") || undefined,
        search: url.searchParams.get("search") || undefined,
      });
      sendJson(res, 200, { ok: true, ...payload });
      return true;
    }

    const ticketMatch = path.match(/^\/api\/admin\/tickets\/(\d+)$/);
    if (req.method === "GET" && ticketMatch) {
      await loadAdminUser(req);
      const id = parseId(ticketMatch[1]);
      if (!id) {
        sendJson(res, 400, { ok: false, error: "شناسه تیکت نامعتبر است" });
        return true;
      }
      const result = await getAdminSupportTicket(id);
      if (!result) {
        sendJson(res, 404, { ok: false, error: "تیکت پیدا نشد" });
        return true;
      }
      sendJson(res, 200, { ok: true, ...result });
      return true;
    }

    const ticketReplyMatch = path.match(/^\/api\/admin\/tickets\/(\d+)\/reply$/);
    if (req.method === "POST" && ticketReplyMatch) {
      const { telegramUser, user } = await loadAdminUser(req, { write: true });
      const id = parseId(ticketReplyMatch[1]);
      if (!id) {
        sendJson(res, 400, { ok: false, error: "شناسه تیکت نامعتبر است" });
        return true;
      }
      const body = await readJsonBody(req);
      const result = await replyAdminSupportTicket(id, {
        body: body.body,
        status: body.status,
      });
      await writeAdminAudit({
        req,
        actor: user,
        action: "ticket.reply",
        targetType: "support_ticket",
        targetId: id,
        meta: { status: body.status || "answered" },
      });
      log.event("api", `POST /api/admin/tickets/${id}/reply by:${telegramUser.id}`);
      sendJson(res, 200, { ok: true, ...result });
      return true;
    }

    if (req.method === "GET" && path === "/api/admin/settings/support-contact") {
      await loadAdminUser(req);
      const settings = await getSupportContactSettings();
      sendJson(res, 200, { ok: true, ...settings });
      return true;
    }

    if (
      (req.method === "PUT" || req.method === "PATCH") &&
      path === "/api/admin/settings/support-contact"
    ) {
      const { telegramUser, user } = await loadAdminUser(req, { write: true });
      const body = await readJsonBody(req);
      const current = await getSupportContactSettings();
      let telegramUsername = current.telegramUsername;
      let enabled = current.enabled;

      if (body.telegramUsername !== undefined || body.username !== undefined) {
        telegramUsername = await setSupportTelegramUsername(
          body.telegramUsername ?? body.username ?? "",
        );
        if (telegramUsername && body.enabled === undefined) {
          enabled = await setSupportTelegramEnabled(true);
        } else if (!telegramUsername) {
          enabled = false;
        }
      }

      if (body.enabled !== undefined) {
        if (body.enabled && !telegramUsername) {
          sendJson(res, 400, {
            ok: false,
            error: "ابتدا آیدی تلگرام پشتیبانی را ذخیره کنید",
          });
          return true;
        }
        enabled = await setSupportTelegramEnabled(Boolean(body.enabled));
      }

      const settings = { telegramUsername, enabled };
      await writeAdminAudit({
        req,
        actor: user,
        action: "settings.support_contact",
        targetType: "settings",
        targetId: null,
        meta: settings,
      });
      log.event(
        "api",
        `PUT /api/admin/settings/support-contact by:${telegramUser.id} user:${telegramUsername || "cleared"} enabled:${enabled}`,
      );
      sendJson(res, 200, { ok: true, ...settings });
      return true;
    }

    if (req.method === "GET" && path === "/api/admin/system-channels/bot") {
      await loadAdminUser(req);
      const info = await getAdminSystemChannelsBotInfo();
      sendJson(res, 200, { ok: true, ...info });
      return true;
    }

    if (req.method === "GET" && path === "/api/admin/system-channels") {
      await loadAdminUser(req);
      const payload = await listAdminSystemChannels();
      sendJson(res, 200, { ok: true, ...payload });
      return true;
    }

    const registerMatch = path.match(
      /^\/api\/admin\/system-channels\/([^/]+)\/register$/,
    );
    if (req.method === "POST" && registerMatch) {
      const { telegramUser, user } = await loadAdminUser(req, { write: true });
      const slotKey = decodeURIComponent(registerMatch[1]);
      const body = await readJsonBody(req);
      try {
        const result = await registerAdminSystemChannel(user, slotKey, body.link);
        await writeAdminAudit({
          req,
          actor: user,
          action: "system_channel.register",
          targetType: "system_channel",
          targetId: slotKey,
        });
        log.event(
          "api",
          `POST /api/admin/system-channels/${slotKey}/register by:${telegramUser.id}`,
        );
        sendJson(res, 200, { ok: true, ...result });
      } catch (error) {
        if (error instanceof AdminSystemChannelError) throw error;
        throw error;
      }
      return true;
    }

    const activeMatch = path.match(
      /^\/api\/admin\/system-channels\/([^/]+)\/active$/,
    );
    if (req.method === "POST" && activeMatch) {
      const { telegramUser, user } = await loadAdminUser(req, { write: true });
      const slotKey = decodeURIComponent(activeMatch[1]);
      const body = await readJsonBody(req);
      const result = await setAdminSystemChannelActive(slotKey, Boolean(body.isActive));
      await writeAdminAudit({
        req,
        actor: user,
        action: "system_channel.active",
        targetType: "system_channel",
        targetId: slotKey,
        meta: { isActive: Boolean(body.isActive) },
      });
      log.event(
        "api",
        `POST /api/admin/system-channels/${slotKey}/active by:${telegramUser.id}`,
      );
      sendJson(res, 200, { ok: true, ...result });
      return true;
    }

    const deactivateMatch = path.match(
      /^\/api\/admin\/system-channels\/([^/]+)\/deactivate$/,
    );
    if (req.method === "POST" && deactivateMatch) {
      const { telegramUser, user } = await loadAdminUser(req, { write: true });
      const slotKey = decodeURIComponent(deactivateMatch[1]);
      const result = await deactivateAdminSystemChannel(slotKey);
      await writeAdminAudit({
        req,
        actor: user,
        action: "system_channel.deactivate",
        targetType: "system_channel",
        targetId: slotKey,
      });
      log.event(
        "api",
        `POST /api/admin/system-channels/${slotKey}/deactivate by:${telegramUser.id}`,
      );
      sendJson(res, 200, { ok: true, ...result });
      return true;
    }

    const deleteChannelMatch = path.match(/^\/api\/admin\/system-channels\/([^/]+)$/);
    if (req.method === "DELETE" && deleteChannelMatch) {
      const { telegramUser, user } = await loadAdminUser(req, { write: true });
      const slotKey = decodeURIComponent(deleteChannelMatch[1]);
      const result = await deleteAdminSystemChannel(slotKey);
      await writeAdminAudit({
        req,
        actor: user,
        action: "system_channel.delete",
        targetType: "system_channel",
        targetId: slotKey,
      });
      log.event(
        "api",
        `DELETE /api/admin/system-channels/${slotKey} by:${telegramUser.id}`,
      );
      sendJson(res, 200, { ok: true, ...result });
      return true;
    }

    if (req.method === "GET" && path === "/api/admin/panels") {
      await loadAdminUser(req);
      const url = new URL(req.url || "/", "http://localhost");
      const withConnection = url.searchParams.get("connection") === "1";
      const withStats = url.searchParams.get("stats") === "1";
      const payload = await listPasarGuardPanels({ withConnection, withStats });
      sendJson(res, 200, { ok: true, ...payload });
      return true;
    }

    if (
      (req.method === "PUT" || req.method === "PATCH") &&
      path === "/api/admin/panels/reorder"
    ) {
      const { telegramUser, user } = await loadAdminUser(req, { write: true });
      const body = await readJsonBody(req);
      const payload = await reorderPasarGuardPanels(body.order);
      await writeAdminAudit({
        req,
        actor: user,
        action: "panel.reorder",
        targetType: "pasarguard_panel",
        targetId: "bulk",
        meta: { count: body.order?.length ?? 0 },
      });
      log.event("api", `PUT /api/admin/panels/reorder by:${telegramUser.id}`);
      sendJson(res, 200, { ok: true, ...payload });
      return true;
    }

    const panelDetailMatch = path.match(/^\/api\/admin\/panels\/(\d+)$/);
    if (req.method === "GET" && panelDetailMatch) {
      await loadAdminUser(req);
      const panelId = parseId(panelDetailMatch[1]);
      if (!panelId) {
        sendJson(res, 400, { ok: false, error: "شناسه پنل نامعتبر است" });
        return true;
      }
      const payload = await getPasarGuardPanelDetail(panelId);
      sendJson(res, 200, { ok: true, ...payload });
      return true;
    }

    if (req.method === "POST" && path === "/api/admin/panels") {
      const { telegramUser, user } = await loadAdminUser(req, { write: true });
      const body = await readJsonBody(req);
      const panel = await createPasarGuardPanel(body);
      await writeAdminAudit({
        req,
        actor: user,
        action: "panel.create",
        targetType: "pasarguard_panel",
        targetId: panel.id,
        meta: { name: panel.name },
      });
      log.event("api", `POST /api/admin/panels by:${telegramUser.id}`);
      sendJson(res, 201, { ok: true, panel });
      return true;
    }

    if (req.method === "PATCH" && panelDetailMatch) {
      const { telegramUser, user } = await loadAdminUser(req, { write: true });
      const panelId = parseId(panelDetailMatch[1]);
      if (!panelId) {
        sendJson(res, 400, { ok: false, error: "شناسه پنل نامعتبر است" });
        return true;
      }
      const body = await readJsonBody(req);
      const panel = await updatePasarGuardPanel(panelId, body);
      await writeAdminAudit({
        req,
        actor: user,
        action: "panel.update",
        targetType: "pasarguard_panel",
        targetId: panel.id,
      });
      log.event("api", `PATCH /api/admin/panels/${panelId} by:${telegramUser.id}`);
      sendJson(res, 200, { ok: true, panel });
      return true;
    }

    if (req.method === "DELETE" && panelDetailMatch) {
      const { telegramUser, user } = await loadAdminUser(req, { write: true });
      const panelId = parseId(panelDetailMatch[1]);
      if (!panelId) {
        sendJson(res, 400, { ok: false, error: "شناسه پنل نامعتبر است" });
        return true;
      }
      const result = await deletePasarGuardPanel(panelId);
      await writeAdminAudit({
        req,
        actor: user,
        action: "panel.delete",
        targetType: "pasarguard_panel",
        targetId: String(panelId),
      });
      log.event("api", `DELETE /api/admin/panels/${panelId} by:${telegramUser.id}`);
      sendJson(res, 200, { ok: true, ...result });
      return true;
    }

    const panelTestMatch = path.match(/^\/api\/admin\/panels\/(\d+)\/test$/);
    if (req.method === "POST" && panelTestMatch) {
      await loadAdminUser(req);
      const panelId = parseId(panelTestMatch[1]);
      if (!panelId) {
        sendJson(res, 400, { ok: false, error: "شناسه پنل نامعتبر است" });
        return true;
      }
      const connection = await testPasarGuardPanelConnection(panelId);
      sendJson(res, 200, { ok: true, connection });
      return true;
    }

    const panelToggleMatch = path.match(/^\/api\/admin\/panels\/(\d+)\/toggle\/([^/]+)$/);
    if (req.method === "POST" && panelToggleMatch) {
      const { telegramUser, user } = await loadAdminUser(req, { write: true });
      const panelId = parseId(panelToggleMatch[1]);
      const kind = decodeURIComponent(panelToggleMatch[2]);
      if (!panelId) {
        sendJson(res, 400, { ok: false, error: "شناسه پنل نامعتبر است" });
        return true;
      }
      const panel = await togglePasarGuardPanelFlag(panelId, kind);
      await writeAdminAudit({
        req,
        actor: user,
        action: "panel.toggle",
        targetType: "pasarguard_panel",
        targetId: panel.id,
        meta: { kind },
      });
      log.event(
        "api",
        `POST /api/admin/panels/${panelId}/toggle/${kind} by:${telegramUser.id}`,
      );
      sendJson(res, 200, { ok: true, panel });
      return true;
    }

    return false;
  } catch (error) {
    sendRouteError(res, error, req, path);
    return true;
  }
}
