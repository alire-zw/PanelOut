import { loadAuthedUser } from "../lib/auth.js";
import {
  getWalletTransactions,
  syncWalletTransactions,
} from "../db/walletTransactions.js";
import {
  executeTransfer,
  findTransferByCode,
  searchTransferRecipients,
} from "../db/transfers.js";
import { readJsonBody } from "../http/body.js";
import { sendJson } from "../http/respond.js";
import { log } from "../lib/logger.js";

function sendRouteError(res, error) {
  const status = error.status || 500;
  if (status >= 500) log.error("api", error);
  else log.warn("api", error.message || "request failed");
  sendJson(res, status, { ok: false, error: error.message || "Unauthorized" });
}

export async function handleWalletRoutes(req, res, path) {
  if (!path.startsWith("/api/wallet")) return false;

  try {
    if (req.method === "GET" && path === "/api/wallet/transactions") {
      const { telegramUser } = await loadAuthedUser(req);
      const payload = await getWalletTransactions(telegramUser.id);
      log.event(
        "api",
        `GET /api/wallet/transactions tg:${telegramUser.id} count:${payload.items.length}`,
      );
      sendJson(res, 200, { ok: true, ...payload });
      return true;
    }

    if (req.method === "GET" && path === "/api/wallet/transactions/sync") {
      const { telegramUser } = await loadAuthedUser(req);
      const url = new URL(req.url || "/", "http://localhost");
      const version = url.searchParams.get("version") || "";
      const result = await syncWalletTransactions(telegramUser.id, version);
      log.event(
        "api",
        `GET /api/wallet/transactions/sync tg:${telegramUser.id} changed:${result.changed}`,
      );
      sendJson(res, 200, { ok: true, ...result });
      return true;
    }

    if (req.method === "GET" && path === "/api/wallet/transfer/recipients") {
      const { telegramUser } = await loadAuthedUser(req);
      const url = new URL(req.url || "/", "http://localhost");
      const query = url.searchParams.get("q") || "";
      const recipients = await searchTransferRecipients(query, {
        excludeTelegramId: telegramUser.id,
      });
      log.event(
        "api",
        `GET /api/wallet/transfer/recipients tg:${telegramUser.id} count:${recipients.length}`,
      );
      sendJson(res, 200, { ok: true, recipients });
      return true;
    }

    if (req.method === "POST" && path === "/api/wallet/transfer") {
      const { telegramUser } = await loadAuthedUser(req);
      const body = await readJsonBody(req);
      const result = await executeTransfer({
        fromTelegramId: telegramUser.id,
        toTelegramId: body.toTelegramId ?? body.recipientTelegramId,
        amountToman: body.amount ?? body.amountToman,
      });
      log.event(
        "api",
        `POST /api/wallet/transfer ${result.transferId} tg:${telegramUser.id}`,
      );
      sendJson(res, 201, { ok: true, transfer: result });
      return true;
    }

    const transferMatch = path.match(/^\/api\/wallet\/transfer\/([^/]+)$/);
    if (req.method === "GET" && transferMatch) {
      const { telegramUser } = await loadAuthedUser(req);
      const transferCode = decodeURIComponent(transferMatch[1]);
      const transfer = await findTransferByCode(transferCode, telegramUser.id);
      if (!transfer) {
        sendJson(res, 404, { ok: false, error: "تراکنش یافت نشد" });
        return true;
      }
      log.event("api", `GET /api/wallet/transfer/${transferCode}`);
      sendJson(res, 200, { ok: true, transfer });
      return true;
    }

    return false;
  } catch (error) {
    sendRouteError(res, error);
    return true;
  }
}
