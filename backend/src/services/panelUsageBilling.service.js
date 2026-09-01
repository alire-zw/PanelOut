import { getSql } from "../db/postgres.js";
import { findPasarGuardPanelById } from "../db/pasarguardPanels.js";
import { createPanelUsageCharge } from "../db/panelUsageCharges.js";
import { getPricingSettings } from "../db/pricingSettings.js";
import { PanelServiceType } from "../db/userPanelSubscriptions.js";
import { getBotApi } from "../bot/api.js";
import { config } from "../config.js";
import { log } from "../lib/logger.js";
import { invalidateWalletTransactionsCache } from "../db/walletTransactions.js";
import {
  activateAllPanelAdminDisabledUsers,
  disableAllPanelAdminActiveUsers,
  getPanelAdminUsedTraffic,
} from "../lib/panelProvision.js";
import {
  buildPanelUsageBillingContext,
  calculateTrafficBytesForCostIrt,
  calculateUsageCostIrt,
  getBalanceThresholdIrt,
  PANEL_USAGE_WARN_RESET_GB,
  PANEL_USAGE_WARN_TIERS_GB,
  normalizeTrafficBytes,
  toBigInt,
} from "../lib/usageBillingMath.js";

const BILLABLE_TYPES = [PanelServiceType.USAGE, PanelServiceType.RESELLER];

function formatToman(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function formatGb(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function buildWalletKeyboard() {
  return {
    inline_keyboard: [[
      {
        text: "💳 ورود به کیف پول",
        web_app: { url: config.miniAppDeepLink("wallet", "/wallet") },
      },
    ]],
  };
}

function buildPanelsKeyboard() {
  return {
    inline_keyboard: [[
      {
        text: "📋 ورود به پنل‌های من",
        web_app: { url: config.miniAppDeepLink("panels", "/dashboard/panels") },
      },
    ]],
  };
}

function formatPanelLabel(panelUsername) {
  return panelUsername ? `<code>${panelUsername}</code>` : "پنل ریسلری";
}

function buildLowBalanceTierMessage(remainingGb, balance, { isReseller, panelUsername } = {}) {
  if (isReseller) {
    const panelLabel = formatPanelLabel(panelUsername);
    return [
      `💳 <b>هشدار موجودی پنل ریسلری: ${formatGb(remainingGb)} گیگ باقی مانده</b>`,
      "",
      `📋 پنل: ${panelLabel}`,
      `💰 موجودی کیف پول این پنل: <b>${formatToman(balance)}</b> تومان`,
      "",
      `⚠️ موجودی کیف پول ${panelLabel} کمتر از معادل <b>${formatGb(remainingGb)}</b> گیگابایت است و در صورت اتمام، کاربران این پنل غیرفعال می‌شوند.`,
      "",
      "💡 از بخش پنل‌های من، موجودی را به کیف پول این پنل تخصیص دهید.",
    ].join("\n");
  }

  return [
    `💳 <b>هشدار موجودی: ${formatGb(remainingGb)} گیگابایت باقی مانده</b>`,
    "",
    `💰 موجودی فعلی: <b>${formatToman(balance)}</b> تومان`,
    "",
    `⚠️ موجودی کیف پول کمتر از معادل <b>${formatGb(remainingGb)}</b> گیگابایت است و در صورت اتمام، کاربران پنل غیرفعال می‌شوند.`,
    "",
    "💡 برای ادامه سرویس، کیف پول را شارژ کنید.",
  ].join("\n");
}

function buildExhaustedMessage({ isReseller, panelUsername } = {}) {
  if (isReseller) {
    const panelLabel = formatPanelLabel(panelUsername);
    return [
      "💳 <b>موجودی کیف پول پنل ریسلری تمام شد</b>",
      "",
      `📋 پنل: ${panelLabel}`,
      "💰 موجودی کیف پول این پنل: <b>0</b> تومان",
      "",
      `⚠️ موجودی کیف پول ${panelLabel} به پایان رسیده و مصرف ترافیک این پنل متوقف شده است.`,
      "",
      "💡 از بخش پنل‌های من، موجودی را به کیف پول این پنل تخصیص دهید.",
    ].join("\n");
  }

  return [
    "💳 <b>موجودی کیف پول تمام شد</b>",
    "",
    "💰 موجودی فعلی: <b>0</b> تومان",
    "",
    "⚠️ موجودی شما به پایان رسیده و مصرف ترافیک متوقف شده است.",
    "",
    "💡 همین حالا کیف پول را شارژ کنید تا سرویس قطع نشود.",
  ].join("\n");
}

function buildSuspendedMessage({ isReseller, panelUsername }) {
  if (isReseller) {
    const panelLabel = formatPanelLabel(panelUsername);
    return [
      "🛑 <b>کاربران پنل ریسلری غیرفعال شدند</b>",
      "",
      `📋 پنل: ${panelLabel}`,
      "💰 موجودی کیف پول این پنل: <b>0</b> تومان",
      "",
      `⚠️ موجودی کیف پول ${panelLabel} تمام شده و کاربران فعال این پنل غیرفعال شدند.`,
      "",
      "💡 از بخش پنل‌های من، موجودی را به کیف پول این پنل تخصیص دهید.",
    ].join("\n");
  }

  return [
    "🛑 <b>کاربران پنل غیرفعال شدند</b>",
    "",
    "💰 موجودی فعلی: <b>0</b> تومان",
    "",
    "⚠️ موجودی کیف پول شما تمام شده و کاربران فعال اکانت ادمین شما در پنل غیرفعال شدند.",
    "",
    "💡 پس از شارژ کیف پول، کاربران غیرفعال‌شده به‌صورت خودکار فعال می‌شوند.",
  ].join("\n");
}

function buildReactivatedMessage({ balance, panelUsername, isReseller }) {
  const panelLabel = formatPanelLabel(panelUsername);

  if (isReseller) {
    return [
      "✅ <b>سرویس پنل ریسلری دوباره فعال شد</b>",
      "",
      `📋 پنل: ${panelLabel}`,
      `💰 موجودی کیف پول این پنل: <b>${formatToman(balance)}</b> تومان`,
      "",
      `🟢 کاربران غیرفعال‌شده ${panelLabel} پس از تخصیص موجودی دوباره فعال شدند.`,
      "",
      "💡 از بخش پنل‌های من وضعیت و موجودی این پنل را مشاهده کنید.",
    ].join("\n");
  }

  return [
    "✅ <b>سرویس پنل دوباره فعال شد</b>",
    "",
    `💰 موجودی فعلی: <b>${formatToman(balance)}</b> تومان`,
    "",
    panelUsername
      ? `🟢 کاربران غیرفعال‌شده پنل ${panelLabel} پس از شارژ کیف پول دوباره فعال شدند.`
      : "🟢 کاربران غیرفعال‌شده پنل شما پس از شارژ کیف پول دوباره فعال شدند.",
    "",
    "💡 از بخش پنل‌های من وضعیت و جزئیات پنل را مشاهده کنید.",
  ].join("\n");
}

async function sendBalanceNotification(telegramUserId, text, replyMarkup = buildWalletKeyboard()) {
  try {
    const api = getBotApi();
    await api.sendMessage(Number(telegramUserId), text, {
      parse_mode: "HTML",
      reply_markup: replyMarkup,
      link_preview_options: { is_disabled: true },
    });
  } catch (err) {
    log.warn("billing", `notify fail tg:${telegramUserId} — ${err.message || err}`);
  }
}

function notificationScopeFor(row) {
  return row.service_type === PanelServiceType.RESELLER ? "panel" : "main";
}

async function loadNotificationState(sql, row) {
  const scope = notificationScopeFor(row);
  if (scope === "main") {
    const [state] = await sql`
      SELECT balance_warn_tier, exhausted_notified, suspended_notified
      FROM user_panel_subscriptions
      WHERE user_row_id = ${row.user_row_id}
        AND service_type = ${PanelServiceType.USAGE}
        AND status <> 'deactivated'
      ORDER BY id ASC
      LIMIT 1
    `;
    return {
      scope,
      balanceWarnTier: Number(state?.balance_warn_tier ?? row.balance_warn_tier ?? 0),
      exhaustedNotified: Boolean(state?.exhausted_notified ?? row.exhausted_notified),
      suspendedNotified: Boolean(state?.suspended_notified ?? row.suspended_notified),
    };
  }

  return {
    scope,
    balanceWarnTier: Number(row.balance_warn_tier ?? 0),
    exhaustedNotified: Boolean(row.exhausted_notified),
    suspendedNotified: Boolean(row.suspended_notified),
  };
}

async function resetNotificationState(sql, row) {
  const scope = notificationScopeFor(row);
  if (scope === "main") {
    await sql`
      UPDATE user_panel_subscriptions
      SET
        balance_warn_tier = 0,
        exhausted_notified = FALSE,
        suspended_notified = FALSE,
        updated_at = NOW()
      WHERE user_row_id = ${row.user_row_id}
        AND service_type = ${PanelServiceType.USAGE}
        AND status <> 'deactivated'
    `;
    return;
  }

  await sql`
    UPDATE user_panel_subscriptions
    SET
      balance_warn_tier = 0,
      exhausted_notified = FALSE,
      suspended_notified = FALSE,
      updated_at = NOW()
    WHERE id = ${row.id}
  `;
}

async function saveNotificationState(sql, row, patch) {
  const scope = notificationScopeFor(row);
  const balanceWarnTier = patch.balance_warn_tier ?? patch.balanceWarnTier;
  const exhaustedNotified = patch.exhausted_notified ?? patch.exhaustedNotified;
  const suspendedNotified = patch.suspended_notified ?? patch.suspendedNotified;

  if (scope === "main") {
    await sql`
      UPDATE user_panel_subscriptions
      SET
        balance_warn_tier = COALESCE(${balanceWarnTier ?? null}, balance_warn_tier),
        exhausted_notified = COALESCE(${exhaustedNotified ?? null}, exhausted_notified),
        suspended_notified = COALESCE(${suspendedNotified ?? null}, suspended_notified),
        updated_at = NOW()
      WHERE user_row_id = ${row.user_row_id}
        AND service_type = ${PanelServiceType.USAGE}
        AND status <> 'deactivated'
    `;
    return;
  }

  await sql`
    UPDATE user_panel_subscriptions
    SET
      balance_warn_tier = COALESCE(${balanceWarnTier ?? null}, balance_warn_tier),
      exhausted_notified = COALESCE(${exhaustedNotified ?? null}, exhausted_notified),
      suspended_notified = COALESCE(${suspendedNotified ?? null}, suspended_notified),
      updated_at = NOW()
    WHERE id = ${row.id}
  `;
}

function resolveNextWarnTier(balance, pricePerGb, notifiedMinTier) {
  for (const gb of PANEL_USAGE_WARN_TIERS_GB) {
    const threshold = getBalanceThresholdIrt(gb, pricePerGb);
    if (balance >= threshold) continue;
    if (notifiedMinTier !== 0 && gb >= notifiedMinTier) continue;
    return gb;
  }
  return null;
}

function isResellerRow(row) {
  return row.service_type === PanelServiceType.RESELLER;
}

function walletSourceFor(row) {
  return isResellerRow(row) ? "panel" : "main";
}

function billingBalanceFrom(row, userBalance) {
  if (isResellerRow(row)) return toBigInt(row.wallet_balance);
  return toBigInt(userBalance);
}

function resolveBillableAmount(balance, delta, pricePerGb) {
  const fullCostIrt = calculateUsageCostIrt(delta, pricePerGb);
  if (fullCostIrt <= 0n) return null;

  if (balance <= 0n) {
    return { chargeAmount: 0n, billedBytes: 0n, fullCostIrt, insufficient: true };
  }
  if (balance >= fullCostIrt) {
    return { chargeAmount: fullCostIrt, billedBytes: delta, fullCostIrt, insufficient: false };
  }

  let billedBytes = calculateTrafficBytesForCostIrt(balance, pricePerGb);
  if (billedBytes > delta) billedBytes = delta;
  if (billedBytes <= 0n) {
    return { chargeAmount: 0n, billedBytes: 0n, fullCostIrt, insufficient: true };
  }

  let chargeAmount = calculateUsageCostIrt(billedBytes, pricePerGb);
  if (chargeAmount > balance) {
    billedBytes = calculateTrafficBytesForCostIrt(balance, pricePerGb);
    if (billedBytes > delta) billedBytes = delta;
    chargeAmount = calculateUsageCostIrt(billedBytes, pricePerGb);
  }

  return {
    chargeAmount,
    billedBytes,
    fullCostIrt,
    insufficient: billedBytes < delta,
  };
}

async function loadBillableSubscriptions() {
  const sql = getSql();
  return sql`
    SELECT
      s.*,
      u.id AS user_row_id,
      u.user_id AS telegram_user_id,
      u.balance AS user_balance
    FROM user_panel_subscriptions s
    JOIN users u ON u.id = s.user_row_id
    WHERE s.service_type IN ('panel_usage', 'panel_reseller')
      AND s.status <> 'deactivated'
    ORDER BY s.id ASC
  `;
}

async function suspendSubscriptionOnPanel(row, panel) {
  if (row.status === "suspended" || row.status === "deactivated") return false;

  try {
    await disableAllPanelAdminActiveUsers(panel, row.client_username);
  } catch (err) {
    log.error(
      "billing",
      `suspend fail sub:${row.id} user:${row.client_username} — ${err.message || err}`,
    );
    return false;
  }

  const sql = getSql();
  await sql`
    UPDATE user_panel_subscriptions
    SET status = 'suspended', updated_at = NOW()
    WHERE id = ${row.id}
  `;

  log.event("billing", `suspended sub:${row.id} admin:${row.client_username}`);
  return true;
}

export async function reactivatePanelSubscriptionOnPanel(row, panel) {
  if (row.status !== "suspended") return false;

  await activateAllPanelAdminDisabledUsers(panel, row.client_username);

  const sql = getSql();
  await sql`
    UPDATE user_panel_subscriptions
    SET status = 'active', updated_at = NOW()
    WHERE id = ${row.id}
  `;

  log.event("billing", `reactivated sub:${row.id} admin:${row.client_username}`);
  return true;
}

async function billSubscriptionUsage(row, panel, currentUsed, billingCtx) {
  const sql = getSql();
  let lastBilled = toBigInt(row.last_billed_traffic_bytes);
  let prepaid = normalizeTrafficBytes(row.prepaid_traffic_bytes);

  if (currentUsed < lastBilled) {
    if (lastBilled > prepaid) {
      lastBilled = currentUsed;
      prepaid = 0n;
      await sql`
        UPDATE user_panel_subscriptions
        SET
          last_billed_traffic_bytes = ${String(lastBilled)},
          prepaid_traffic_bytes = 0,
          last_billed_at = NOW(),
          updated_at = NOW()
        WHERE id = ${row.id}
      `;
    } else {
      lastBilled = currentUsed;
      await sql`
        UPDATE user_panel_subscriptions
        SET
          last_billed_traffic_bytes = ${String(lastBilled)},
          last_billed_at = NOW(),
          updated_at = NOW()
        WHERE id = ${row.id}
      `;
    }
  }

  const watermark = lastBilled > prepaid ? lastBilled : prepaid;
  const delta = currentUsed > watermark ? currentUsed - watermark : 0n;
  if (delta <= 0n) {
    return { billed: false, amountIrt: 0n };
  }

  const balance = billingBalanceFrom(row, row.user_balance);
  const billable = resolveBillableAmount(balance, delta, billingCtx.pricePerGb);
  if (!billable) return { billed: false, amountIrt: 0n };

  if (billable.chargeAmount <= 0n || billable.billedBytes <= 0n) {
    return {
      billed: false,
      amountIrt: billable.fullCostIrt,
      pending: true,
      insufficient: true,
    };
  }

  const newLastBilled = watermark + billable.billedBytes;
  const source = walletSourceFor(row);
  const chargeAmountNum = Number(billable.chargeAmount);

  try {
    await sql.begin(async (tx) => {
      if (source === "panel") {
        const [fresh] = await tx`
          SELECT wallet_balance FROM user_panel_subscriptions
          WHERE id = ${row.id}
          FOR UPDATE
        `;
        const freshBal = toBigInt(fresh?.wallet_balance);
        if (freshBal < billable.chargeAmount) {
          throw new Error("INSUFFICIENT_BALANCE");
        }
        await tx`
          UPDATE user_panel_subscriptions
          SET
            wallet_balance = wallet_balance - ${chargeAmountNum},
            last_billed_traffic_bytes = ${String(newLastBilled)},
            last_billed_at = NOW(),
            updated_at = NOW()
          WHERE id = ${row.id}
        `;
      } else {
        const [fresh] = await tx`
          SELECT balance FROM users WHERE id = ${row.user_row_id} FOR UPDATE
        `;
        const freshBal = toBigInt(fresh?.balance);
        if (freshBal < billable.chargeAmount) {
          throw new Error("INSUFFICIENT_BALANCE");
        }
        await tx`
          UPDATE users
          SET balance = balance - ${chargeAmountNum}
          WHERE id = ${row.user_row_id}
        `;
        await tx`
          UPDATE user_panel_subscriptions
          SET
            last_billed_traffic_bytes = ${String(newLastBilled)},
            last_billed_at = NOW(),
            updated_at = NOW()
          WHERE id = ${row.id}
        `;
      }

      await createPanelUsageCharge(tx, {
        subscriptionId: row.id,
        userRowId: row.user_row_id,
        telegramUserId: row.telegram_user_id,
        trafficBytes: billable.billedBytes,
        amountIrt: billable.chargeAmount,
        trafficAfterBytes: newLastBilled,
        walletSource: source,
      });

      const balanceAfter = balance - billable.chargeAmount;
      const resetThreshold = getBalanceThresholdIrt(
        PANEL_USAGE_WARN_RESET_GB,
        billingCtx.pricePerGb,
      );
      if (balanceAfter >= resetThreshold) {
        if (isResellerRow(row)) {
          await tx`
            UPDATE user_panel_subscriptions
            SET
              balance_warn_tier = 0,
              exhausted_notified = FALSE,
              suspended_notified = FALSE,
              updated_at = NOW()
            WHERE id = ${row.id}
          `;
        } else {
          await tx`
            UPDATE user_panel_subscriptions
            SET
              balance_warn_tier = 0,
              exhausted_notified = FALSE,
              suspended_notified = FALSE,
              updated_at = NOW()
            WHERE user_row_id = ${row.user_row_id}
              AND service_type = ${PanelServiceType.USAGE}
              AND status <> 'deactivated'
          `;
        }
      }
    });
  } catch (err) {
    if (err.message === "INSUFFICIENT_BALANCE") {
      return {
        billed: false,
        amountIrt: billable.fullCostIrt,
        pending: true,
        insufficient: true,
      };
    }
    throw err;
  }

  log.event(
    "billing",
    `charged sub:${row.id} bytes:${billable.billedBytes} irt:${billable.chargeAmount} source:${source}${billable.insufficient ? " partial" : ""}`,
  );

  void invalidateWalletTransactionsCache(row.telegram_user_id).catch((err) => {
    log.warn("billing", `wallet cache invalidate fail — ${err.message || err}`);
  });

  return {
    billed: true,
    amountIrt: billable.chargeAmount,
    partial: billable.insufficient,
    insufficient: billable.insufficient,
  };
}

async function processSubscriptionBalanceState(row, panel, balance, billResult, billingCtx) {
  const sql = getSql();
  const telegramId = row.telegram_user_id;
  const isReseller = isResellerRow(row);
  const resetThreshold = getBalanceThresholdIrt(
    PANEL_USAGE_WARN_RESET_GB,
    billingCtx.pricePerGb,
  );
  const notifyState = await loadNotificationState(sql, row);
  const panelUsername = row.client_username;
  const panelContext = { isReseller, panelUsername };
  const actionKeyboard = isReseller ? buildPanelsKeyboard() : buildWalletKeyboard();

  if (balance >= resetThreshold) {
    if (
      notifyState.balanceWarnTier !== 0
      || notifyState.exhaustedNotified
      || notifyState.suspendedNotified
    ) {
      await resetNotificationState(sql, row);
    }
  } else {
    const nextTier = resolveNextWarnTier(
      balance,
      billingCtx.pricePerGb,
      notifyState.balanceWarnTier,
    );
    if (nextTier != null && balance > 0n) {
      await sendBalanceNotification(
        telegramId,
        buildLowBalanceTierMessage(nextTier, Number(balance), panelContext),
        actionKeyboard,
      );
      await saveNotificationState(sql, row, { balance_warn_tier: nextTier });
      notifyState.balanceWarnTier = nextTier;
    } else if (balance === 0n && row.status === "active" && !notifyState.exhaustedNotified) {
      await sendBalanceNotification(
        telegramId,
        buildExhaustedMessage(panelContext),
        actionKeyboard,
      );
      await saveNotificationState(sql, row, { exhausted_notified: true });
      notifyState.exhaustedNotified = true;
    }
  }

  const needsSuspend =
    row.status === "active" && (balance === 0n || billResult?.partial === true);

  let newlySuspended = false;
  if (needsSuspend) {
    newlySuspended = await suspendSubscriptionOnPanel(row, panel);
  }

  if (newlySuspended && !notifyState.suspendedNotified) {
    await sendBalanceNotification(
      telegramId,
      buildSuspendedMessage(panelContext),
      actionKeyboard,
    );
    await saveNotificationState(sql, row, { suspended_notified: true });
  }
}

async function initializeBillingBaseline(row, panel) {
  const currentUsed = await getPanelAdminUsedTraffic(panel, row.client_username);
  const sql = getSql();
  await sql`
    UPDATE user_panel_subscriptions
    SET
      last_billed_traffic_bytes = ${String(currentUsed)},
      last_billed_at = NOW(),
      updated_at = NOW()
    WHERE id = ${row.id}
  `;
  return currentUsed;
}

export async function processPanelUsageSubscription(row) {
  if (row.status === "deactivated") {
    return { billed: false, skipped: true };
  }

  const panel = await findPasarGuardPanelById(row.panel_id, { includePassword: true });
  if (!panel) {
    log.warn("billing", `panel missing for sub:${row.id}`);
    return { billed: false, skipped: true };
  }

  let currentUsed;
  try {
    currentUsed = await getPanelAdminUsedTraffic(panel, row.client_username);
  } catch (err) {
    if (err.status === 404) {
      log.warn("billing", `admin missing sub:${row.id} user:${row.client_username}`);
      return { billed: false, skipped: true };
    }
    throw err;
  }

  const prepaid = normalizeTrafficBytes(row.prepaid_traffic_bytes);
  const withinPrepaid = prepaid > 0n && currentUsed <= prepaid;
  const balance = billingBalanceFrom(row, row.user_balance);
  if (row.status === "suspended" && balance === 0n && !withinPrepaid) {
    return { billed: false, skipped: true };
  }

  if (row.last_billed_at == null) {
    currentUsed = await initializeBillingBaseline(row, panel);
  }

  const pricing = await getPricingSettings();
  const billingCtx = buildPanelUsageBillingContext(pricing.panelUsagePricePerGb);
  const billResult = await billSubscriptionUsage(row, panel, currentUsed, billingCtx);

  if (withinPrepaid) {
    return billResult;
  }

  const sql = getSql();
  const [refreshed] = await sql`
    SELECT
      s.*,
      u.id AS user_row_id,
      u.user_id AS telegram_user_id,
      u.balance AS user_balance
    FROM user_panel_subscriptions s
    JOIN users u ON u.id = s.user_row_id
    WHERE s.id = ${row.id}
  `;

  const nextBalance = billingBalanceFrom(refreshed || row, refreshed?.user_balance ?? row.user_balance);
  await processSubscriptionBalanceState(
    refreshed || row,
    panel,
    nextBalance,
    billResult,
    billingCtx,
  );

  return billResult;
}

export async function runPanelUsageBillingCycle() {
  const subscriptions = await loadBillableSubscriptions();
  let billed = 0;
  let errors = 0;

  for (const row of subscriptions) {
    try {
      const result = await processPanelUsageSubscription(row);
      if (result?.billed) billed += 1;
    } catch (err) {
      errors += 1;
      log.error("billing", `sub #${row.id} fail — ${err.message || err}`);
    }
  }

  return { total: subscriptions.length, billed, errors };
}

export async function runPanelUsageBillingForUser(telegramUserId) {
  const sql = getSql();
  const rows = await sql`
    SELECT
      s.*,
      u.id AS user_row_id,
      u.user_id AS telegram_user_id,
      u.balance AS user_balance
    FROM user_panel_subscriptions s
    JOIN users u ON u.id = s.user_row_id
    WHERE u.user_id = ${telegramUserId}
      AND s.service_type IN ('panel_usage', 'panel_reseller')
      AND s.status <> 'deactivated'
  `;

  for (const row of rows) {
    try {
      await processPanelUsageSubscription(row);
    } catch (err) {
      log.error("billing", `user ${telegramUserId} sub fail — ${err.message || err}`);
    }
  }

  void import("../db/userPanelsCache.js")
    .then(({ refreshMyPanelsLive }) => refreshMyPanelsLive(telegramUserId))
    .catch(() => {});
}

/**
 * After main wallet top-up: reactivate personal usage panels when balance > 0.
 * Reseller panels only reactivate when their dedicated wallet has funds.
 */
export async function reactivateSuspendedPanelsAfterWalletCredit(telegramUserId) {
  const sql = getSql();
  const rows = await sql`
    SELECT
      s.*,
      u.id AS user_row_id,
      u.user_id AS telegram_user_id,
      u.balance AS user_balance
    FROM user_panel_subscriptions s
    JOIN users u ON u.id = s.user_row_id
    WHERE u.user_id = ${telegramUserId}
      AND s.service_type IN ('panel_usage', 'panel_reseller')
      AND s.status = 'suspended'
  `;

  /** @type {Array<{ row: typeof rows[number], panelUsername: string }>} */
  const reactivated = [];

  for (const row of rows) {
    const bal = billingBalanceFrom(row, row.user_balance);
    if (bal <= 0n) continue;

    const panel = await findPasarGuardPanelById(row.panel_id, { includePassword: true });
    if (!panel) continue;

    try {
      const didReactivate = await reactivatePanelSubscriptionOnPanel(row, panel);
      if (didReactivate) {
        reactivated.push({
          row,
          panelUsername: row.client_username,
        });
      }
    } catch (err) {
      log.error("billing", `reactivate fail sub:${row.id} — ${err.message || err}`);
    }
  }

  if (reactivated.length > 0) {
    const primary = reactivated[0];
    const balance = billingBalanceFrom(primary.row, primary.row.user_balance);
    const pricing = await getPricingSettings();
    const resetThreshold = getBalanceThresholdIrt(
      PANEL_USAGE_WARN_RESET_GB,
      pricing.panelUsagePricePerGb,
    );

    if (balance >= resetThreshold) {
      for (const item of reactivated) {
        await resetNotificationState(sql, item.row);
      }
    }

    await sendBalanceNotification(
      telegramUserId,
      buildReactivatedMessage({
        balance: Number(balance),
        panelUsername: reactivated.length === 1 ? primary.panelUsername : null,
        isReseller: isResellerRow(primary.row),
      }),
      buildPanelsKeyboard(),
    );
  }

  await runPanelUsageBillingForUser(telegramUserId);
}

export async function togglePanelSubscription(telegramUserId, subscriptionId, action) {
  const sql = getSql();
  const [row] = await sql`
    SELECT
      s.*,
      u.id AS user_row_id,
      u.user_id AS telegram_user_id,
      u.balance AS user_balance
    FROM user_panel_subscriptions s
    JOIN users u ON u.id = s.user_row_id
    WHERE s.id = ${Number(subscriptionId)}
      AND u.user_id = ${telegramUserId}
    LIMIT 1
  `;

  if (!row) {
    const err = new Error("پنل یافت نشد");
    err.status = 404;
    throw err;
  }

  if (![PanelServiceType.USAGE, PanelServiceType.RESELLER].includes(row.service_type)) {
    const err = new Error("فقط پنل مصرفی و ریسلری قابل تعلیق/فعال‌سازی است");
    err.status = 400;
    throw err;
  }

  const panel = await findPasarGuardPanelById(row.panel_id, { includePassword: true });
  if (!panel) {
    const err = new Error("سرور پنل در دسترس نیست");
    err.status = 503;
    throw err;
  }

  if (action === "deactivate" || action === "suspend") {
    if (row.status === "deactivated") {
      return { subscriptionId: String(row.id), status: row.status };
    }
    await disableAllPanelAdminActiveUsers(panel, row.client_username);
    const nextStatus = action === "deactivate" ? "deactivated" : "suspended";
    await sql`
      UPDATE user_panel_subscriptions
      SET status = ${nextStatus}, updated_at = NOW()
      WHERE id = ${row.id}
    `;
    void import("../db/userPanelsCache.js")
      .then(({ invalidateUserPanelsCache }) => invalidateUserPanelsCache(telegramUserId))
      .catch(() => {});
    return { subscriptionId: String(row.id), status: nextStatus };
  }

  if (action === "reactivate" || action === "activate") {
    if (row.status === "active") {
      return { subscriptionId: String(row.id), status: "active" };
    }
    if (row.status === "deactivated") {
      const err = new Error("این پنل غیرفعال دائمی شده است");
      err.status = 409;
      throw err;
    }

    const pricing = await getPricingSettings();
    const billingCtx = buildPanelUsageBillingContext(pricing.panelUsagePricePerGb);
    const bal = billingBalanceFrom(row, row.user_balance);
    if (bal < billingCtx.reactivateMinIrt) {
      const err = new Error(
        `حداقل موجودی ${Number(billingCtx.reactivateMinIrt).toLocaleString("fa-IR")} تومان برای فعال‌سازی لازم است`,
      );
      err.status = 402;
      err.code = "INSUFFICIENT_BALANCE";
      throw err;
    }

    await reactivatePanelSubscriptionOnPanel(row, panel);
    void import("../db/userPanelsCache.js")
      .then(({ invalidateUserPanelsCache }) => invalidateUserPanelsCache(telegramUserId))
      .catch(() => {});
    return { subscriptionId: String(row.id), status: "active" };
  }

  const err = new Error("عملیات نامعتبر است");
  err.status = 400;
  throw err;
}
