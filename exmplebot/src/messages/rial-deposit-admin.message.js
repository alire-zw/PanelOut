import { PremiumEmoji, premiumEmoji } from "../constants/emojis.js";
import { formatJalaliDateTime } from "../lib/tehran-time.js";
import { formatToman } from "./wallet.message.js";

const STATUS_LABELS = {
  pending: "در انتظار بررسی",
  approved: "تأیید شده",
  rejected: "رد شده",
};

export function buildAdminRialDepositCaption(deposit, user, reviewerName = null) {
  const username = user.username ? `@${user.username}` : "ندارد";
  const lines = [
    `${premiumEmoji(PremiumEmoji.RIAL_TOPUP_TITLE)} <b>درخواست واریز ریالی</b>`,
    "",
    `${premiumEmoji(PremiumEmoji.WALLET_BALANCE)} <b>مبلغ:</b> <code>${formatToman(deposit.amountIrt)}</code> تومان`,
    `${premiumEmoji(PremiumEmoji.WALLET_HEADER)} <b>کاربر:</b> ${user.userFullname}`,
    `${premiumEmoji(PremiumEmoji.NERD)} <b>آیدی:</b> <code>${user.userId}</code>`,
    `${premiumEmoji(PremiumEmoji.SUPPORT)} <b>یوزرنیم:</b> ${username}`,
    "",
    `${premiumEmoji(PremiumEmoji.STATS_UPDATED)} <b>وضعیت:</b> ${STATUS_LABELS[deposit.status] ?? deposit.status}`,
    `${premiumEmoji(PremiumEmoji.TOPUP_CONFIRM)} <b>زمان ثبت:</b> ${formatJalaliDateTime(deposit.dateCreated)}`,
  ];

  if (deposit.reviewedAt && reviewerName) {
    lines.push(
      `${premiumEmoji(PremiumEmoji.ADMIN_PANEL)} <b>بررسی توسط:</b> ${reviewerName}`,
    );
  }

  return lines.join("\n");
}

export function buildUserRialDepositApprovedMessage(amountIrt, newBalance) {
  const amount = formatToman(amountIrt);
  const balance = formatToman(newBalance);

  return [
    `${premiumEmoji(PremiumEmoji.WALLET_HEADER)} <b>واریز ریالی شما با موفقیت تأیید شد</b>`,
    "",
    `${premiumEmoji(PremiumEmoji.DEPOSIT_TRX)} <b>مبلغ واریزی:</b> <code>${amount}</code> تومان`,
    `${premiumEmoji(PremiumEmoji.DEPOSIT_IRT)} <b>موجودی جدید کیف پول:</b> <code>${balance}</code> تومان`,
    "",
    `${premiumEmoji(PremiumEmoji.TOPUP_METHOD_CHOOSE)} درخواست واریز شما توسط <b>ادمین</b> تأیید و مبلغ به <b>موجودی حساب</b> اضافه شد. از این لحظه می‌توانید برای <b>خرید سرویس‌های جدید</b> یا <b>تمدید سرویس‌های فعلی</b>، از موجودی کیف پول خود استفاده کنید.`,
  ].join("\n");
}

export function buildUserRialDepositRejectedMessage(amountIrt) {
  return [
    `${premiumEmoji(PremiumEmoji.TOPUP_DESC)} <b>درخواست واریز ریالی رد شد</b>`,
    "",
    `${premiumEmoji(PremiumEmoji.WALLET_BALANCE)} مبلغ: <code>${formatToman(amountIrt)}</code> تومان`,
    "",
    `${premiumEmoji(PremiumEmoji.RIAL_NOTIFY)} در صورت نیاز با پشتیبانی تماس بگیرید.`,
  ].join("\n");
}
