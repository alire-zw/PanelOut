import { getBotApi } from "../bot/api.js";
import { findUserByTelegramId } from "../db/users.js";
import { getActiveAdminSystemChannel } from "../db/systemChannels.js";
import { config } from "../config.js";
import { log } from "../lib/logger.js";

const STATUS_LABELS = {
  pending: "Pending review",
  approved: "Approved ✅",
  rejected: "Rejected ❌",
};

export function buildCardChargeCallbackData(action, chargeId) {
  const prefix = action === "approve" ? "cc:a" : "cc:r";
  return `${prefix}:${chargeId}`;
}

export function parseCardChargeCallbackData(data) {
  const match = String(data || "").match(/^cc:([ar]):(\d+)$/);
  if (!match) return null;
  return {
    action: match[1] === "a" ? "approve" : "reject",
    chargeId: Number(match[2]),
  };
}

export function buildCardChargeAdminReportKeyboard(chargeId) {
  return {
    inline_keyboard: [
      [
        {
          text: "✅ Approve",
          callback_data: buildCardChargeCallbackData("approve", chargeId),
        },
        {
          text: "❌ Reject",
          callback_data: buildCardChargeCallbackData("reject", chargeId),
        },
      ],
      [{ text: "📱 Open Mini App", url: config.telegramAppUrl }],
    ],
  };
}

export function buildCardChargeResolvedKeyboard() {
  return {
    inline_keyboard: [[{ text: "📱 Open Mini App", url: config.telegramAppUrl }]],
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function boldLabel(label) {
  return `<b>${escapeHtml(label)}</b>`;
}

function formatTomans(amount) {
  return `${Math.round(Number(amount) || 0).toLocaleString("en-US")} Tomans`;
}

function formatTehranTime(dateInput) {
  const date = dateInput ? new Date(dateInput) : new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}/${get("month")}/${get("day")} - ${get("hour")}:${get("minute")}`;
}

function maskCardNumber(cardNumber) {
  const digits = String(cardNumber || "").replace(/\D/g, "");
  if (digits.length < 4) return "—";
  return `****${digits.slice(-4)}`;
}

function displayUserName(user) {
  if (user?.username?.trim()) {
    return `@${user.username.replace(/^@/, "").trim()}`;
  }
  if (user?.realName?.trim()) return user.realName.trim();
  if (user?.telegramName?.trim()) return user.telegramName.trim();
  return String(user?.telegramId ?? "—");
}

export function buildCardChargeAdminReportMessage({
  chargeId,
  amountToman,
  createdAt,
  user,
  bankCard,
  status = "pending",
}) {
  const userLine = user?.username?.trim()
    ? `<code>${escapeHtml(displayUserName(user))}</code>`
    : escapeHtml(displayUserName(user));

  const statusLabel = STATUS_LABELS[status] ?? STATUS_LABELS.pending;

  const lines = [
    `💳 ${boldLabel("New Top-up Request:")} #${escapeHtml(String(chargeId))}`,
    "",
    `🙋‍♂️ ${boldLabel("User:")} ${userLine}`,
    `📟 ${boldLabel("UserID:")} <code>${escapeHtml(String(user?.telegramId ?? "—"))}</code>`,
    `💸 ${boldLabel("Amount:")} ${escapeHtml(formatTomans(amountToman))}`,
  ];

  if (bankCard?.cardNumber) {
    lines.push(
      `🏦 ${boldLabel("Dest. Card:")} <code>${escapeHtml(maskCardNumber(bankCard.cardNumber))}</code>`,
    );
  }

  lines.push(
    `⏳ ${boldLabel("Time:")} ${escapeHtml(formatTehranTime(createdAt))}`,
    `📌 ${boldLabel("Status:")} ${escapeHtml(statusLabel)}`,
  );

  return lines.join("\n");
}

/**
 * Fire-and-forget: notify admin_report channel about a new card top-up request.
 * Text only — no receipt image.
 */
export async function notifyCardChargeCreated(charge) {
  try {
    const channel = await getActiveAdminSystemChannel("admin_report");
    if (!channel?.chatId) {
      log.event("notify", "card charge report skipped — admin_report channel missing");
      return;
    }

    const rawUser =
      charge.user ||
      (await findUserByTelegramId(charge.telegramUserId).catch(() => null));

    const user = rawUser
      ? {
          telegramId:
            rawUser.telegramId ??
            rawUser.user_id ??
            charge.telegramUserId,
          username: rawUser.username ?? rawUser.user_name ?? null,
          realName: rawUser.realName ?? rawUser.user_full_name ?? null,
          telegramName:
            rawUser.telegramName ?? rawUser.user_telegram_name ?? null,
        }
      : { telegramId: charge.telegramUserId };

    const text = buildCardChargeAdminReportMessage({
      chargeId: charge.id,
      amountToman: charge.amountToman,
      createdAt: charge.createdAt,
      user,
      bankCard: charge.bankCard ?? null,
    });

    const sent = await getBotApi().sendMessage(Number(channel.chatId), text, {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      reply_markup: buildCardChargeAdminReportKeyboard(charge.id),
    });

    const messageId = sent?.message_id;
    if (messageId != null) {
      const { setCardChargeReportMessage } = await import("../db/cardCharges.js");
      await setCardChargeReportMessage(
        charge.id,
        Number(channel.chatId),
        Number(messageId),
      );
    }

    log.event("notify", `card charge report #${charge.id} → admin_report`);
  } catch (err) {
    log.warn(
      "notify",
      `card charge report fail #${charge?.id} · ${err.message || err}`,
    );
  }
}

/**
 * Update admin_report message after approve/reject (app or channel).
 * Removes Approve/Reject buttons; keeps Open Mini App.
 */
export async function syncCardChargeAdminReport(chargeId) {
  try {
    const { findCardChargeForReport } = await import("../db/cardCharges.js");
    const charge = await findCardChargeForReport(chargeId);
    if (!charge?.reportChatId || !charge?.reportMessageId) {
      log.event(
        "notify",
        `card charge report sync skipped #${chargeId} — message missing`,
      );
      return;
    }

    const rawUser = await findUserByTelegramId(charge.telegramUserId).catch(
      () => null,
    );
    const user = rawUser
      ? {
          telegramId: Number(rawUser.user_id ?? charge.telegramUserId),
          username: rawUser.user_name ?? null,
          realName: rawUser.user_full_name ?? null,
          telegramName: rawUser.user_telegram_name ?? null,
        }
      : { telegramId: charge.telegramUserId };

    const text = buildCardChargeAdminReportMessage({
      chargeId: charge.id,
      amountToman: charge.amountToman,
      createdAt: charge.createdAt,
      user,
      bankCard: charge.bankCard ?? null,
      status: charge.status,
    });

    await getBotApi().editMessageText(
      Number(charge.reportChatId),
      Number(charge.reportMessageId),
      text,
      {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
        reply_markup: buildCardChargeResolvedKeyboard(),
      },
    );

    log.event(
      "notify",
      `card charge report synced #${chargeId} → ${charge.status}`,
    );
  } catch (err) {
    log.warn(
      "notify",
      `card charge report sync fail #${chargeId} · ${err.message || err}`,
    );
  }
}
