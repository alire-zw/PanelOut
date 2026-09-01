import { getSql } from "../db/postgres.js";
import { findPasarGuardPanelById } from "../db/pasarguardPanels.js";
import { OutboundServiceType } from "../db/userPanelSubscriptions.js";
import { getBotApi } from "../bot/api.js";
import { config } from "../config.js";
import { log } from "../lib/logger.js";
import { fetchOutboundUser } from "../lib/outboundProvision.js";
import {
  GB_BYTES,
  OUTBOUND_VOLUME_ALERT_RESET_GB,
  OUTBOUND_VOLUME_ALERT_THRESHOLDS_GB,
} from "../lib/usageBillingMath.js";

const ALERT_FIELDS = {
  15: "volume_remaining_15gb_notified",
  10: "volume_remaining_10gb_notified",
  5: "volume_remaining_5gb_notified",
};

function isRemainingAtOrBelowGb(remainingBytes, thresholdGb) {
  const threshold = BigInt(thresholdGb) * GB_BYTES;
  return remainingBytes <= threshold;
}

function getRemainingBytes(panelUser) {
  const used = BigInt(panelUser?.used_traffic ?? 0);
  const limit = panelUser?.data_limit != null ? BigInt(panelUser.data_limit) : null;
  if (limit == null || limit <= 0n) return null;
  return limit > used ? limit - used : 0n;
}

async function sendVolumeAlert(telegramUserId, text) {
  const bot = getBotApi();
  if (!bot) return;
  try {
    await bot.api.sendMessage(Number(telegramUserId), text, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[
          {
            text: "📋 سرویس‌های من",
            web_app: { url: config.miniAppDeepLink("panels", "/dashboard/panels") },
          },
        ]],
      },
      link_preview_options: { is_disabled: true },
    });
  } catch (err) {
    log.warn("outbound-alert", `notify fail tg:${telegramUserId} — ${err.message || err}`);
  }
}

export async function processOutboundVolumeSubscriptionAlert(row) {
  if (row.service_type !== OutboundServiceType.VOLUME) return { notified: 0 };
  if (row.status === "deactivated") return { notified: 0 };
  if (Number(row.volume_gb) <= 0) return { notified: 0 };

  const panel = await findPasarGuardPanelById(row.panel_id, { includePassword: true });
  if (!panel) return { notified: 0 };

  let panelUser;
  try {
    panelUser = await fetchOutboundUser(panel, row.client_username);
  } catch (err) {
    if (err.status === 404) return { notified: 0 };
    throw err;
  }

  const remainingBytes = getRemainingBytes(panelUser);
  if (remainingBytes == null) return { notified: 0 };

  const sql = getSql();
  const resetThreshold = BigInt(OUTBOUND_VOLUME_ALERT_RESET_GB) * GB_BYTES;
  let notified = 0;

  if (remainingBytes > resetThreshold) {
    await sql`
      UPDATE user_panel_subscriptions
      SET
        volume_remaining_15gb_notified = FALSE,
        volume_remaining_10gb_notified = FALSE,
        volume_remaining_5gb_notified = FALSE,
        updated_at = NOW()
      WHERE id = ${row.id}
    `;
    return { notified: 0 };
  }

  const name = row.client_username;
  for (const thresholdGb of OUTBOUND_VOLUME_ALERT_THRESHOLDS_GB) {
    const field = ALERT_FIELDS[thresholdGb];
    if (!isRemainingAtOrBelowGb(remainingBytes, thresholdGb)) continue;
    if (row[field]) continue;

    await sendVolumeAlert(
      row.telegram_user_id,
      [
        `⚠️ <b>هشدار حجم اوتباند</b>`,
        "",
        `📋 <code>${name}</code>`,
        `📉 کمتر از <b>${thresholdGb}</b> گیگابایت باقی مانده است.`,
        "",
        "💡 برای ادامه سرویس، حجم جدید خریداری کنید.",
      ].join("\n"),
    );

    if (thresholdGb === 15) {
      await sql`
        UPDATE user_panel_subscriptions
        SET volume_remaining_15gb_notified = TRUE, updated_at = NOW()
        WHERE id = ${row.id}
      `;
      row.volume_remaining_15gb_notified = true;
    } else if (thresholdGb === 10) {
      await sql`
        UPDATE user_panel_subscriptions
        SET volume_remaining_10gb_notified = TRUE, updated_at = NOW()
        WHERE id = ${row.id}
      `;
      row.volume_remaining_10gb_notified = true;
    } else if (thresholdGb === 5) {
      await sql`
        UPDATE user_panel_subscriptions
        SET volume_remaining_5gb_notified = TRUE, updated_at = NOW()
        WHERE id = ${row.id}
      `;
      row.volume_remaining_5gb_notified = true;
    }
    notified += 1;
  }

  return { notified };
}

export async function runOutboundVolumeAlertCycle() {
  const sql = getSql();
  const rows = await sql`
    SELECT s.*, u.user_id AS telegram_user_id
    FROM user_panel_subscriptions s
    JOIN users u ON u.id = s.user_row_id
    WHERE s.service_type = ${OutboundServiceType.VOLUME}
      AND s.status = 'active'
      AND s.volume_gb > 0
  `;

  let notified = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      const result = await processOutboundVolumeSubscriptionAlert(row);
      notified += result.notified || 0;
    } catch (err) {
      errors += 1;
      log.error("outbound-alert", `sub #${row.id} fail — ${err.message || err}`);
    }
  }

  return { total: rows.length, notified, errors };
}
