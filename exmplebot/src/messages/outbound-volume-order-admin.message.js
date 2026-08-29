import { formatOutboundVolumeText } from "../lib/outbound-volume-steps.js";
import { PremiumEmoji, premiumEmoji } from "../constants/emojis.js";
import { formatJalaliDateTime } from "../lib/tehran-time.js";
import { formatToman } from "./wallet.message.js";

const STATUS_LABELS = {
  pending: "در انتظار بررسی",
  approved: "تأیید شده",
  rejected: "رد شده",
  completed: "تکمیل شده",
};

export function buildAdminOutboundVolumeOrderCaption(order, user, reviewerName = null) {
  const username = user.username ? `@${user.username}` : "ندارد";

  const lines = [
    `${premiumEmoji(PremiumEmoji.NEW_SERVICE)} <b>سفارش پکیج حجمی اوتباند</b>`,
    "",
    `${premiumEmoji(PremiumEmoji.STATS_DESC)} <b>حجم:</b> ${formatOutboundVolumeText(order.volumeGb)}`,
    `${premiumEmoji(PremiumEmoji.DEPOSIT_IRT)} <b>مبلغ:</b> <code>${formatToman(order.amountIrt)}</code> تومان`,
    `${premiumEmoji(PremiumEmoji.TOPUP_METHOD_CHOOSE)} <b>روش پرداخت:</b> کارت به کارت`,
    "",
    `${premiumEmoji(PremiumEmoji.WALLET_HEADER)} <b>کاربر:</b> ${user.userFullname}`,
    `${premiumEmoji(PremiumEmoji.NERD)} <b>آیدی:</b> <code>${user.userId}</code>`,
    `${premiumEmoji(PremiumEmoji.SUPPORT)} <b>یوزرنیم:</b> ${username}`,
    "",
    `${premiumEmoji(PremiumEmoji.STATS_UPDATED)} <b>وضعیت:</b> ${STATUS_LABELS[order.status] ?? order.status}`,
    `${premiumEmoji(PremiumEmoji.TOPUP_CONFIRM)} <b>زمان ثبت:</b> ${formatJalaliDateTime(order.dateCreated)}`,
  ];

  if (order.reviewedAt && reviewerName) {
    lines.push(
      `${premiumEmoji(PremiumEmoji.ADMIN_PANEL)} <b>بررسی توسط:</b> ${reviewerName}`,
    );
  }

  return lines.join("\n");
}

export function buildUserOutboundVolumeOrderApprovedMessage(order) {
  return [
    `${premiumEmoji(PremiumEmoji.DEPOSIT_SUCCESS)} <b>سفارش شما تأیید شد</b>`,
    "",
    `${premiumEmoji(PremiumEmoji.STATS_DESC)} <b>حجم:</b> ${formatOutboundVolumeText(order.volumeGb)}`,
    `${premiumEmoji(PremiumEmoji.DEPOSIT_IRT)} <b>مبلغ:</b> <code>${formatToman(order.amountIrt)}</code> تومان`,
    "",
    `${premiumEmoji(PremiumEmoji.RIAL_NOTIFY)} پرداخت شما تأیید شد. جزئیات فعال‌سازی سرویس به‌زودی در اختیار شما قرار می‌گیرد.`,
  ].join("\n");
}

export function buildUserOutboundVolumeOrderRejectedMessage(order) {
  return [
    `${premiumEmoji(PremiumEmoji.TOPUP_DESC)} <b>سفارش شما رد شد</b>`,
    "",
    `${premiumEmoji(PremiumEmoji.DEPOSIT_IRT)} مبلغ: <code>${formatToman(order.amountIrt)}</code> تومان`,
    "",
    `${premiumEmoji(PremiumEmoji.RIAL_NOTIFY)} در صورت نیاز با پشتیبانی تماس بگیرید.`,
  ].join("\n");
}
