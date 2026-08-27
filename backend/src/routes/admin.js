import { loadAdminUser } from "../lib/auth.js";
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
import {
  listUsersAdmin,
  findUserByTelegramId,
  countUsers,
  toPublicUser,
} from "../db/users.js";
import {
  countOpenSupportTickets,
  getAdminSupportTicket,
  getSupportTelegramUsername,
  listAdminSupportTickets,
  replyAdminSupportTicket,
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
import { getSql } from "../db/postgres.js";
import { readJsonBody } from "../http/body.js";
import { sendJson } from "../http/respond.js";
import { writeAdminAudit } from "../lib/audit.js";
import { attachSignedReceiptUrl } from "../lib/signedUploads.js";
import { log } from "../lib/logger.js";

function sendRouteError(res, error) {
  const status = error.status || 500;
  if (status === 401 || status === 403) {
    sendJson(res, status === 403 ? 403 : 401, {
      ok: false,
      error: status === 403 ? error.message || "Forbidden" : "Unauthorized",
    });
    return;
  }
  if (status === 429) {
    sendJson(
      res,
      429,
      { ok: false, error: "Too many requests" },
      { "retry-after": String(error.retryAfterSec || 60) },
    );
    return;
  }
  if (status >= 500) log.error("api", error);
  else log.warn("api", error.message || "request failed");
  const payload = { ok: false, error: error.message || "Request failed" };
  if (error.name === "AdminSystemChannelError" && error.code) {
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
      const sql = getSql();
      const [usersTotal, pendingCharges, activeCards, openTickets] =
        await Promise.all([
          countUsers(),
          sql`SELECT COUNT(*)::int AS count FROM card_charge_requests WHERE status = 'pending'`,
          sql`SELECT COUNT(*)::int AS count FROM admin_bank_cards WHERE is_active = TRUE`,
          countOpenSupportTickets(),
        ]);

      sendJson(res, 200, {
        ok: true,
        overview: {
          usersCount: usersTotal,
          pendingCharges: Number(pendingCharges[0]?.count ?? 0),
          activeCards: Number(activeCards[0]?.count ?? 0),
          openTickets,
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
      const telegramUsername = await getSupportTelegramUsername();
      sendJson(res, 200, { ok: true, telegramUsername });
      return true;
    }

    if (req.method === "PUT" && path === "/api/admin/settings/support-contact") {
      const { telegramUser, user } = await loadAdminUser(req, { write: true });
      const body = await readJsonBody(req);
      const telegramUsername = await setSupportTelegramUsername(
        body.telegramUsername ?? body.username ?? "",
      );
      await writeAdminAudit({
        req,
        actor: user,
        action: "settings.support_contact",
        targetType: "settings",
        targetId: null,
        meta: { telegramUsername },
      });
      log.event(
        "api",
        `PUT /api/admin/settings/support-contact by:${telegramUser.id} user:${telegramUsername || "cleared"}`,
      );
      sendJson(res, 200, { ok: true, telegramUsername });
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

    return false;
  } catch (error) {
    sendRouteError(res, error);
    return true;
  }
}
