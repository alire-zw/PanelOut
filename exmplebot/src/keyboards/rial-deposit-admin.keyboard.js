import { InlineKeyboard } from "grammy";

export function buildRialDepositReviewCallback(action, depositId) {
  return `admin:rial_deposit:${action}:${depositId}`;
}

export function rialDepositReviewKeyboard(depositId, status) {
  if (status === "approved") {
    return new InlineKeyboard().text(
      "✅ تأیید شده",
      buildRialDepositReviewCallback("reviewed", depositId),
    );
  }

  if (status === "rejected") {
    return new InlineKeyboard().text(
      "❌ رد شده",
      buildRialDepositReviewCallback("reviewed", depositId),
    );
  }

  return new InlineKeyboard()
    .text("✅ تأیید", buildRialDepositReviewCallback("approve", depositId))
    .text("❌ رد", buildRialDepositReviewCallback("reject", depositId));
}
