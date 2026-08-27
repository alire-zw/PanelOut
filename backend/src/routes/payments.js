import { loadAuthedUser } from "../lib/auth.js";
import {
  createCardChargeRequest,
  listCardChargesForUser,
  uploadReceiptOnly,
} from "../db/cardCharges.js";
import {
  getBankCardsCached,
  syncBankCardsCached,
} from "../db/bankCardsCache.js";
import { invalidateWalletTransactionsCache } from "../db/walletTransactions.js";
import { invalidateAdminChargesCache } from "../db/adminChargesCache.js";
import { readJsonBody } from "../http/body.js";
import { sendJson } from "../http/respond.js";
import { attachSignedReceiptUrl } from "../lib/signedUploads.js";
import { log } from "../lib/logger.js";

function sendRouteError(res, error) {
  const status = error.status || 500;
  if (status === 401 || status === 403) {
    sendJson(res, 401, { ok: false, error: "Unauthorized" });
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
  sendJson(res, status, { ok: false, error: error.message || "Request failed" });
}

export async function handlePaymentRoutes(req, res, path) {
  if (!path.startsWith("/api/payments")) return false;

  try {
    if (req.method === "GET" && path === "/api/payments/cards") {
      await loadAuthedUser(req);
      const payload = await getBankCardsCached("active");
      log.event("api", `GET /api/payments/cards count:${payload.cards.length}`);
      sendJson(res, 200, { ok: true, ...payload });
      return true;
    }

    if (req.method === "GET" && path === "/api/payments/cards/sync") {
      await loadAuthedUser(req);
      const url = new URL(req.url || "/", "http://localhost");
      const version = url.searchParams.get("version") || "";
      const result = await syncBankCardsCached("active", version);
      log.event("api", `GET /api/payments/cards/sync changed:${result.changed}`);
      sendJson(res, 200, { ok: true, ...result });
      return true;
    }

    if (req.method === "POST" && path === "/api/payments/receipt-upload") {
      const { telegramUser } = await loadAuthedUser(req);
      const body = await readJsonBody(req, { limitBytes: 7_000_000 });
      const receipt = await uploadReceiptOnly({
        base64: body.receiptBase64,
        mimeType: body.receiptMimeType,
        telegramUserId: telegramUser.id,
      });
      log.event("api", `POST /api/payments/receipt-upload ${receipt.receiptPath}`);
      sendJson(res, 201, { ok: true, receipt });
      return true;
    }

    if (req.method === "POST" && path === "/api/payments/card-charge") {
      const { telegramUser } = await loadAuthedUser(req);
      const body = await readJsonBody(req, { limitBytes: 7_000_000 });
      const charge = await createCardChargeRequest({
        telegramUserId: telegramUser.id,
        amountToman: body.amount,
        bankCardId: body.bankCardId,
        receiptBase64: body.receiptBase64,
        receiptMimeType: body.receiptMimeType,
        receiptPath: body.receiptPath,
      });
      await invalidateWalletTransactionsCache(telegramUser.id);
      await invalidateAdminChargesCache();
      log.event(
        "api",
        `POST /api/payments/card-charge #${charge.id} tg:${telegramUser.id}`,
      );
      sendJson(res, 201, {
        ok: true,
        charge: attachSignedReceiptUrl(charge, telegramUser.id),
      });
      return true;
    }

    if (req.method === "GET" && path === "/api/payments/card-charges/me") {
      const { telegramUser } = await loadAuthedUser(req);
      const charges = await listCardChargesForUser(telegramUser.id);
      log.event(
        "api",
        `GET /api/payments/card-charges/me tg:${telegramUser.id} count:${charges.length}`,
      );
      sendJson(res, 200, {
        ok: true,
        charges: charges.map((c) => attachSignedReceiptUrl(c, telegramUser.id)),
      });
      return true;
    }

    return false;
  } catch (error) {
    sendRouteError(res, error);
    return true;
  }
}
