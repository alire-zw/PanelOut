import { PremiumEmoji, premiumEmoji } from "../constants/emojis.js";
import { formatOutboundVolumeText } from "../lib/outbound-volume-steps.js";
import {
  OUTBOUND_USAGE_CRITICAL_BALANCE_GB,
  OUTBOUND_USAGE_LOW_BALANCE_GB,
} from "../constants/service-types.js";
import { formatToman } from "./wallet.message.js";

export function buildOutboundUsageLowBalance10GbMessage(balance) {
  return [
    `${premiumEmoji(PremiumEmoji.TOPUP_DESC)} <b>موجودی کیف پول رو به اتمام است</b>`,
    "",
    `${premiumEmoji(PremiumEmoji.WALLET_BALANCE)} موجودی فعلی شما: <b>${formatToman(balance)}</b> تومان`,
    "",
    `${premiumEmoji(PremiumEmoji.OUTBOUND_USAGE_SUSPEND)} موجودی کیف پول شما کمتر از <b>${formatOutboundVolumeText(OUTBOUND_USAGE_LOW_BALANCE_GB)}</b> شده و <b>اشتراک‌های اوتباند به‌ازای مصرف</b> شما به‌زودی خاموش خواهند شد.`,
    "",
    `${premiumEmoji(PremiumEmoji.WALLET_TOP_UP)} در صورت تمایل به <b>ادامه سرویس</b>، لطفاً کیف پول خود را شارژ کنید:`,
  ].join("\n");
}

export function buildOutboundUsageLowBalance5GbMessage(balance) {
  return [
    `${premiumEmoji(PremiumEmoji.TOPUP_DESC)} <b>هشدار: موجودی بسیار کم</b>`,
    "",
    `${premiumEmoji(PremiumEmoji.WALLET_BALANCE)} موجودی فعلی شما: <b>${formatToman(balance)}</b> تومان`,
    "",
    `${premiumEmoji(PremiumEmoji.OUTBOUND_USAGE_SUSPEND)} موجودی کیف پول شما کمتر از <b>${formatOutboundVolumeText(OUTBOUND_USAGE_CRITICAL_BALANCE_GB)}</b> است و <b>اشتراک‌های اوتباند به‌ازای مصرف</b> شما به‌زودی به‌دلیل اتمام موجودی خاموش می‌شوند.`,
    "",
    `${premiumEmoji(PremiumEmoji.WALLET_TOP_UP)} برای جلوگیری از قطع سرویس، همین حالا کیف پول خود را شارژ کنید:`,
  ].join("\n");
}

export function buildOutboundUsageSuspendedMessage() {
  return [
    `${premiumEmoji(PremiumEmoji.OUTBOUND_USAGE_SUSPEND)} <b>سرویس خاموش شد</b>`,
    "",
    `${premiumEmoji(PremiumEmoji.WALLET_BALANCE)} موجودی کیف پول شما <b>تمام شده</b> و <b>اشتراک‌های اوتباند به‌ازای مصرف</b> شما به‌صورت خودکار خاموش شدند.`,
    "",
    `${premiumEmoji(PremiumEmoji.WALLET_TOP_UP)} پس از <b>شارژ کیف پول</b>، اشتراک‌های شما به‌صورت خودکار دوباره فعال خواهند شد:`,
  ].join("\n");
}
