import {
  approveCardCharge,
  rejectCardCharge,
} from "../../db/cardCharges.js";
import { invalidateAdminChargesCache } from "../../db/adminChargesCache.js";
import { invalidateWalletTransactionsCache } from "../../db/walletTransactions.js";
import { findUserByTelegramId, isStaffRole, toPublicUser } from "../../db/users.js";
import { parseCardChargeCallbackData } from "../../services/cardChargeReport.service.js";
import { log } from "../../lib/logger.js";

export async function handleCardChargeCallback(ctx) {
  const data = ctx.callbackQuery?.data ?? "";
  const parsed = parseCardChargeCallbackData(data);
  if (!parsed) return;

  const actorId = ctx.callbackQuery.from.id;
  const actorRow = await findUserByTelegramId(actorId);
  const actor = actorRow ? toPublicUser(actorRow) : null;

  if (!actor?.canAccessAdminPanel || !isStaffRole(actor.role)) {
    await ctx.answerCallbackQuery({
      text: "You do not have permission to review charges.",
      show_alert: true,
    });
    return;
  }

  const { action, chargeId } = parsed;

  try {
    const charge =
      action === "approve"
        ? await approveCardCharge(chargeId, actorId)
        : await rejectCardCharge(chargeId, actorId);

    await invalidateWalletTransactionsCache(charge.telegramUserId);
    await invalidateAdminChargesCache();

    if (action === "approve") {
      void import("../../services/panelUsageBilling.service.js")
        .then(({ reactivateSuspendedPanelsAfterWalletCredit }) =>
          reactivateSuspendedPanelsAfterWalletCredit(charge.telegramUserId),
        )
        .catch(() => {});
      void import("../../services/outboundUsageBilling.service.js")
        .then(({ reactivateSuspendedOutboundAfterWalletCredit }) =>
          reactivateSuspendedOutboundAfterWalletCredit(charge.telegramUserId),
        )
        .catch(() => {});
    }

    // Channel message is synced inside approveCardCharge / rejectCardCharge.
    await ctx.answerCallbackQuery({
      text: action === "approve" ? "Charge approved ✅" : "Charge rejected ❌",
    });

    log.event(
      "bot",
      `card charge ${action} #${chargeId} by:${actorId} via callback`,
    );
  } catch (err) {
    const message =
      err.status === 404
        ? "Charge request not found."
        : err.status === 409
          ? "This charge was already reviewed."
          : "Could not update charge. Try again in the admin panel.";

    await ctx.answerCallbackQuery({ text: message, show_alert: true });
    log.warn(
      "bot",
      `card charge callback fail #${chargeId} ${action} · ${err.message || err}`,
    );
  }
}
