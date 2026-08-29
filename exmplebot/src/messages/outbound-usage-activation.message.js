import {
  OUTBOUND_USAGE_EXISTING_RESERVE_GB,
  OUTBOUND_USAGE_MIN_BALANCE_GB,
} from "../constants/service-types.js";
import { PremiumEmoji, premiumEmoji } from "../constants/emojis.js";
import { formatOutboundVolumeText } from "../lib/outbound-volume-steps.js";
import { formatToman } from "./wallet.message.js";

export function buildOutboundUsageActivationMessage({
  balance,
  minBalanceIrt,
  minBalanceGb,
}) {
  return [
    `${premiumEmoji(PremiumEmoji.WALLET_BALANCE)} <b>سرویس اوتباند به‌ازای مصرف</b>`,
    "",
    `${premiumEmoji(PremiumEmoji.OUTBOUND_USAGE_ACTIVATE)} شما در حال <b>فعال‌سازی سرویس اوتباند به‌ازای مصرف</b> هستید؛ در این روش مصرف به‌صورت <b>لحظه‌ای</b> از <b>موجودی کیف پول</b> شما کسر می‌شود و <b>حداقل موجودی</b> باید فعال باشد تا سرویس بدون وقفه کار کند.`,
    "",
    `${premiumEmoji(PremiumEmoji.OUTBOUND_USAGE_SUSPEND)} در صورت <b>اتمام موجودی</b>، سرویس به‌صورت خودکار به حالت <b>تعلیق</b> درمی‌آید و پس از <b>شارژ مجدد کیف پول</b> دوباره فعال خواهد شد.`,
    "",
    `${premiumEmoji(PremiumEmoji.WALLET)} <b>موجودی کیف پول:</b> ${formatToman(balance)} تومان`,
    `${premiumEmoji(PremiumEmoji.DEPOSIT_IRT)} <b>حداقل موجودی لازم:</b> معادل ${formatOutboundVolumeText(minBalanceGb)} (${formatToman(minBalanceIrt)} تومان)`,
    "",
    `${premiumEmoji(PremiumEmoji.RIAL_NOTIFY)} در صورت تأیید، برای <b>فعال‌سازی نهایی سرویس</b> دکمه تأیید را انتخاب کنید:`,
  ].join("\n");
}

export function buildOutboundUsageActiveServiceMessage({
  subscriptionName,
  usedGb,
  balance,
  minBalanceIrt,
  minBalanceGb,
  existingCount,
}) {
  const lines = [
    `${premiumEmoji(PremiumEmoji.SERVICE_ACTIVE)} <b>سرویس فعال دارید</b>`,
    "",
    `${premiumEmoji(PremiumEmoji.MANAGE_SERVICES)} شما در حال حاضر یک سرویس اوتباند به‌ازای مصرف با نام اشتراک <b>${subscriptionName}</b> دارید و میزان مصرف شما تاکنون <b>${usedGb}</b> گیگابایت بوده است.`,
    "",
    `${premiumEmoji(PremiumEmoji.OUTBOUND_USAGE_SUSPEND)} در صورت نیاز می‌توانید از طریق دکمه زیر <b>سرویس جدید تهیه کنید</b>.`,
  ];

  if (existingCount > 0) {
    lines.push(
      "",
      `${premiumEmoji(PremiumEmoji.WALLET)} <b>موجودی کیف پول:</b> ${formatToman(balance)} تومان`,
      `${premiumEmoji(PremiumEmoji.DEPOSIT_IRT)} <b>حداقل موجودی برای سرویس جدید:</b> معادل ${formatOutboundVolumeText(minBalanceGb)} (${formatToman(minBalanceIrt)} تومان) — شامل ${formatOutboundVolumeText(OUTBOUND_USAGE_MIN_BALANCE_GB)} فعال‌سازی و ${formatOutboundVolumeText(OUTBOUND_USAGE_EXISTING_RESERVE_GB)} ذخیره برای هر سرویس فعال`,
    );
  }

  return lines.join("\n");
}

export function buildOutboundUsageInsufficientBalanceMessage({
  balance,
  minBalanceIrt,
  minBalanceGb,
  hasExistingSubscription = false,
}) {
  const need = BigInt(minBalanceIrt) - BigInt(balance);

  const lines = [
    `${premiumEmoji(PremiumEmoji.TOPUP_DESC)} <b>موجودی کیف پول کافی نیست</b>`,
    "",
    `${premiumEmoji(PremiumEmoji.WALLET_BALANCE)} موجودی شما: <b>${formatToman(balance)}</b> تومان`,
    `${premiumEmoji(PremiumEmoji.DEPOSIT_IRT)} حداقل لازم: <b>${formatToman(minBalanceIrt)}</b> تومان (معادل ${formatOutboundVolumeText(minBalanceGb)})`,
  ];

  if (hasExistingSubscription) {
    lines.push(
      "",
      `${premiumEmoji(PremiumEmoji.MANAGE_SERVICES)} برای تهیه <b>سرویس جدید</b> در کنار سرویس فعال، موجودی شما باید معادل <b>${formatOutboundVolumeText(minBalanceGb)}</b> باشد.`,
    );
  }

  lines.push(
    "",
    `${premiumEmoji(PremiumEmoji.WALLET_TOP_UP)} برای فعال‌سازی به <b>${formatToman(need)}</b> تومان دیگر نیاز دارید. ابتدا کیف پول خود را شارژ کنید.`,
  );

  return lines.join("\n");
}

export function buildOutboundUsageDeactivatedMessage({ subscriptionName }) {
  return [
    `${premiumEmoji(PremiumEmoji.OUTBOUND_USAGE_SUSPEND)} <b>سرویس غیرفعال شد</b>`,
    "",
    `${premiumEmoji(PremiumEmoji.MANAGE_SERVICES)} سرویس <b>${subscriptionName}</b> با موفقیت <b>غیرفعال</b> شد و از این پس هیچ هزینه‌ای از کیف پول شما برای آن کسر نخواهد شد.`,
    "",
    `${premiumEmoji(PremiumEmoji.WALLET_TOP_UP)} این سرویس <b>به‌صورت دستی</b> غیرفعال شده و پس از شارژ کیف پول <b>خودکار فعال نمی‌شود</b>. برای استفاده مجدد باید سرویس جدید تهیه کنید.`,
  ].join("\n");
}
