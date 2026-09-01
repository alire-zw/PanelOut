import { getSql } from "../db/postgres.js";
import { findPasarGuardPanelById } from "../db/pasarguardPanels.js";
import { createOutboundUsageCharge } from "../db/outboundUsageCharges.js";
import { getPricingSettings } from "../db/pricingSettings.js";
import { OutboundServiceType } from "../db/userPanelSubscriptions.js";
import { getBotApi } from "../bot/api.js";
import { config } from "../config.js";
import { log } from "../lib/logger.js";
import { invalidateWalletTransactionsCache } from "../db/walletTransactions.js";
import {
  fetchOutboundUser,
  getOutboundUserUsedTraffic,
  setOutboundUserStatus,
} from "../lib/outboundProvision.js";
import {
  buildOutboundUsageBillingContext,
  calculateTrafficBytesForCostIrt,
  calculateUsageCostIrt,
  getBalanceThresholdIrt,
  getOutboundUsageMinimumBalanceIrt,
  OUTBOUND_USAGE_CRITICAL_BALANCE_GB,
  OUTBOUND_USAGE_LOW_BALANCE_GB,
  OUTBOUND_USAGE_MIN_BALANCE_GB,
  toBigInt,
} from "../lib/usageBillingMath.js";

function formatToman(value) {
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

function buildOutboundKeyboard() {
  return {
    inline_keyboard: [[
      {
        text: "📋 سرویس‌های من",
        web_app: { url: config.miniAppDeepLink("panels", "/dashboard/panels") },
      },
    ]],
  };
}

async function sendTelegramMessage(telegramUserId, text, keyboard) {
  const bot = getBotApi();
  if (!bot) return;
  try {
    await bot.api.sendMessage(Number(telegramUserId), text, {
      parse_mode: "HTML",
      reply_markup: keyboard,
      link_preview_options: { is_disabled: true },
    });
  } catch (err) {
    log.warn("outbound-billing", `notify fail tg:${telegramUserId} — ${err.message || err}`);
  }
}

function resolveBillableAmount(balance, deltaBytes, pricePerGb) {
  const fullCostIrt = calculateUsageCostIrt(deltaBytes, pricePerGb);
  if (fullCostIrt <= 0n) return null;
  if (balance >= fullCostIrt) {
    return {
      chargeAmount: fullCostIrt,
      billedBytes: deltaBytes,
      fullCostIrt,
      insufficient: false,
    };
  }
  if (balance <= 0n) return null;
  const billedBytes = calculateTrafficBytesForCostIrt(balance, pricePerGb);
  if (billedBytes <= 0n) return null;
  return {
    chargeAmount: balance,
    billedBytes,
    fullCostIrt,
    insufficient: true,
  };
}

async function suspendOutboundSubscription(row, panel) {
  await setOutboundUserStatus(panel, row.client_username, "disabled");
  const sql = getSql();
  await sql`
    UPDATE user_panel_subscriptions
    SET status = 'suspended', updated_at = NOW()
    WHERE id = ${row.id}
  `;
}

async function reactivateOutboundOnPanel(row, panel) {
  await setOutboundUserStatus(panel, row.client_username, "active");
  const sql = getSql();
  await sql`
    UPDATE user_panel_subscriptions
    SET status = 'active', suspended_notified = FALSE, updated_at = NOW()
    WHERE id = ${row.id}
  `;
}

export async function processOutboundUsageSubscription(row) {
  if (row.service_type !== OutboundServiceType.USAGE) return { billed: false };
  if (row.status === "deactivated") return { billed: false };

  const panel = await findPasarGuardPanelById(row.panel_id, { includePassword: true });
  if (!panel) return { billed: false };

  const pricing = await getPricingSettings();
  const billingCtx = buildOutboundUsageBillingContext(pricing.outboundPricePerGb);
  const sql = getSql();

  let currentUsed;
  try {
    currentUsed = await getOutboundUserUsedTraffic(panel, row.client_username);
  } catch (err) {
    if (err.status === 404) {
      log.warn("outbound-billing", `user missing sub:${row.id}`);
      return { billed: false };
    }
    throw err;
  }

  let lastBilled = toBigInt(row.last_billed_traffic_bytes);
  if (currentUsed < lastBilled) {
    lastBilled = currentUsed;
    await sql`
      UPDATE user_panel_subscriptions
      SET last_billed_traffic_bytes = ${String(lastBilled)}, updated_at = NOW()
      WHERE id = ${row.id}
    `;
  }

  const delta = currentUsed > lastBilled ? currentUsed - lastBilled : 0n;
  if (delta <= 0n) return { billed: false, amountIrt: 0n };

  const balance = toBigInt(row.user_balance);
  const billable = resolveBillableAmount(balance, delta, billingCtx.pricePerGb);

  if (!billable) {
    if (balance <= 0n && row.status === "active") {
      await suspendOutboundSubscription(row, panel);
      if (!row.suspended_notified) {
        await sendTelegramMessage(
          row.telegram_user_id,
          [
            "🛑 <b>اوتباند مصرفی غیرفعال شد</b>",
            "",
            "💰 موجودی کیف پول: <b>0</b> تومان",
            "",
            "⚠️ موجودی تمام شده و سرویس اوتباند مصرفی متوقف شد.",
            "",
            "💡 پس از شارژ کیف پول، سرویس به‌صورت خودکار فعال می‌شود.",
          ].join("\n"),
          buildWalletKeyboard(),
        );
        await sql`
          UPDATE user_panel_subscriptions
          SET suspended_notified = TRUE, updated_at = NOW()
          WHERE id = ${row.id}
        `;
      }
    }
    return { billed: false, amountIrt: 0n, insufficient: true };
  }

  const newLastBilled = lastBilled + billable.billedBytes;
  const chargeAmountNum = Number(billable.chargeAmount);

  await sql.begin(async (tx) => {
    const [fresh] = await tx`
      SELECT balance FROM users WHERE id = ${row.user_row_id} FOR UPDATE
    `;
    const freshBal = toBigInt(fresh?.balance);
    if (freshBal < billable.chargeAmount) {
      throw new Error("INSUFFICIENT_BALANCE");
    }

    await tx`
      UPDATE users SET balance = balance - ${chargeAmountNum}
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
    await createOutboundUsageCharge(tx, {
      subscriptionId: row.id,
      userRowId: row.user_row_id,
      telegramUserId: row.telegram_user_id,
      trafficBytes: billable.billedBytes,
      amountIrt: billable.chargeAmount,
      trafficAfterBytes: newLastBilled,
    });
  });

  void invalidateWalletTransactionsCache(row.telegram_user_id).catch(() => {});

  const balanceAfter = balance - billable.chargeAmount;
  const low10 = getBalanceThresholdIrt(OUTBOUND_USAGE_LOW_BALANCE_GB, billingCtx.pricePerGb);
  const low5 = getBalanceThresholdIrt(OUTBOUND_USAGE_CRITICAL_BALANCE_GB, billingCtx.pricePerGb);

  if (balanceAfter > 0n && balanceAfter <= low5 && !row.low_balance_5gb_notified) {
    await sendTelegramMessage(
      row.telegram_user_id,
      `💳 <b>هشدار اوتباند:</b> موجودی کمتر از ${OUTBOUND_USAGE_CRITICAL_BALANCE_GB} گیگ — ${formatToman(balanceAfter)} تومان`,
      buildWalletKeyboard(),
    );
    await sql`
      UPDATE user_panel_subscriptions
      SET low_balance_5gb_notified = TRUE, updated_at = NOW()
      WHERE id = ${row.id}
    `;
  } else if (balanceAfter > low5 && balanceAfter <= low10 && !row.low_balance_notified) {
    await sendTelegramMessage(
      row.telegram_user_id,
      `💳 <b>هشدار اوتباند:</b> موجودی کمتر از ${OUTBOUND_USAGE_LOW_BALANCE_GB} گیگ — ${formatToman(balanceAfter)} تومان`,
      buildWalletKeyboard(),
    );
    await sql`
      UPDATE user_panel_subscriptions
      SET low_balance_notified = TRUE, updated_at = NOW()
      WHERE id = ${row.id}
    `;
  }

  if (billable.insufficient || balanceAfter <= 0n) {
    await suspendOutboundSubscription(row, panel);
  }

  return {
    billed: true,
    amountIrt: billable.chargeAmount,
    partial: billable.insufficient,
  };
}

async function loadBillableSubscriptions() {
  const sql = getSql();
  return sql`
    SELECT s.*, u.id AS user_row_id, u.user_id AS telegram_user_id, u.balance AS user_balance
    FROM user_panel_subscriptions s
    JOIN users u ON u.id = s.user_row_id
    WHERE s.service_type = ${OutboundServiceType.USAGE}
      AND s.status <> 'deactivated'
  `;
}

export async function runOutboundUsageBillingCycle() {
  const subscriptions = await loadBillableSubscriptions();
  let billed = 0;
  let errors = 0;

  for (const row of subscriptions) {
    try {
      const result = await processOutboundUsageSubscription(row);
      if (result?.billed) billed += 1;
    } catch (err) {
      errors += 1;
      log.error("outbound-billing", `sub #${row.id} fail — ${err.message || err}`);
    }
  }

  return { total: subscriptions.length, billed, errors };
}

export async function reactivateSuspendedOutboundAfterWalletCredit(telegramUserId) {
  const sql = getSql();
  const pricing = await getPricingSettings();
  const minIrt = getBalanceThresholdIrt(
    OUTBOUND_USAGE_MIN_BALANCE_GB,
    pricing.outboundPricePerGb,
  );

  const rows = await sql`
    SELECT s.*, u.balance AS user_balance
    FROM user_panel_subscriptions s
    JOIN users u ON u.id = s.user_row_id
    WHERE u.user_id = ${telegramUserId}
      AND s.service_type = ${OutboundServiceType.USAGE}
      AND s.status = 'suspended'
  `;

  for (const row of rows) {
    const balance = toBigInt(row.user_balance);
    if (balance < minIrt) continue;

    const panel = await findPasarGuardPanelById(row.panel_id, { includePassword: true });
    if (!panel) continue;

    try {
      await reactivateOutboundOnPanel(row, panel);
      await sql`
        UPDATE user_panel_subscriptions
        SET
          low_balance_notified = FALSE,
          low_balance_5gb_notified = FALSE,
          suspended_notified = FALSE,
          updated_at = NOW()
        WHERE id = ${row.id}
      `;
      await sendTelegramMessage(
        telegramUserId,
        [
          "✅ <b>اوتباند مصرفی دوباره فعال شد</b>",
          "",
          `💰 موجودی: <b>${formatToman(balance)}</b> تومان`,
        ].join("\n"),
        buildOutboundKeyboard(),
      );
    } catch (err) {
      log.error("outbound-billing", `reactivate fail sub:${row.id} — ${err.message || err}`);
    }
  }

  void import("../db/userPanelsCache.js")
    .then(({ refreshMyPanelsLive }) => refreshMyPanelsLive(telegramUserId))
    .catch(() => {});
}
