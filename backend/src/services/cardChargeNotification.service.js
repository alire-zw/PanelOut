import { getBotApi } from "../bot/api.js";
import { emoji, WALLET_EMOJI } from "../bot/messages/premiumEmoji.js";
import { config } from "../config.js";
import { findUserByTelegramId } from "../db/users.js";
import { log } from "../lib/logger.js";

function formatToman(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function buildWalletKeyboard() {
  return {
    inline_keyboard: [[
      {
        text: `${WALLET_EMOJI.card.fallback} ورود به کیف پول`,
        web_app: { url: config.miniAppDeepLink("wallet", "/wallet") },
        icon_custom_emoji_id: WALLET_EMOJI.card.id,
      },
    ]],
  };
}

function buildCardChargeApprovedMessage({ amountToman, newBalance, chargeId }) {
  const { check, money, receipt, briefcase, heart } = WALLET_EMOJI;

  return [
    `${emoji(check)} <b>واریز کارت به کارت شما با موفقیت تأیید شد</b>`,
    "",
    `${emoji(money)} <b>مبلغ واریزی:</b> <code>${formatToman(amountToman)}</code> تومان`,
    `${emoji(receipt)} <b>شماره درخواست:</b> <code>#${chargeId}</code>`,
    "",
    `${emoji(briefcase)} <b>موجودی جدید کیف پول:</b> <code>${formatToman(newBalance)}</code> تومان`,
    "",
    `${emoji(heart)} مبلغ به موجودی حساب شما اضافه شد.`,
  ].join("\n");
}

/**
 * Notify user after card-to-card top-up is approved (admin panel or channel).
 */
export async function notifyCardChargeApproved({
  telegramUserId,
  amountToman,
  chargeId,
}) {
  try {
    const userRow = await findUserByTelegramId(telegramUserId);
    const newBalance = Number(userRow?.balance ?? 0);

    await getBotApi().sendMessage(
      Number(telegramUserId),
      buildCardChargeApprovedMessage({
        amountToman,
        newBalance,
        chargeId,
      }),
      {
        parse_mode: "HTML",
        reply_markup: buildWalletKeyboard(),
      },
    );

    log.event(
      "notify",
      `card charge approved tg:${telegramUserId} #${chargeId}`,
    );
  } catch (err) {
    log.warn(
      "notify",
      `card charge approved fail tg:${telegramUserId} · ${err.message || err}`,
    );
  }
}
