import { InlineKeyboard } from "grammy";

export function buildOutboundVolumeOrderReviewCallback(action, orderId) {
  return `admin:outbound_order:${action}:${orderId}`;
}

export function outboundVolumeOrderReviewKeyboard(orderId, status) {
  if (status === "approved" || status === "completed") {
    return new InlineKeyboard().text(
      "✅ تأیید شده",
      buildOutboundVolumeOrderReviewCallback("reviewed", orderId),
    );
  }

  if (status === "rejected") {
    return new InlineKeyboard().text(
      "❌ رد شده",
      buildOutboundVolumeOrderReviewCallback("reviewed", orderId),
    );
  }

  return new InlineKeyboard()
    .text("✅ تأیید", buildOutboundVolumeOrderReviewCallback("approve", orderId))
    .text("❌ رد", buildOutboundVolumeOrderReviewCallback("reject", orderId));
}
