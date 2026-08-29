import { PremiumEmoji, premiumEmoji } from "../constants/emojis.js";
import { formatOutboundVolumeText } from "../lib/outbound-volume-steps.js";
import {
  PANEL_USAGE_CRITICAL_BALANCE_GB,
  PANEL_USAGE_LOW_BALANCE_GB,
} from "../constants/service-types.js";
import { formatToman } from "./wallet.message.js";

export function buildPanelUsageLowBalance10GbMessage(balance) {
  return [
    `${premiumEmoji(PremiumEmoji.TOPUP_DESC)} <b>موجودی کیف پول رو به اتمام است</b>`,
    "",
    `${premiumEmoji(PremiumEmoji.WALLET_BALANCE)} موجودی فعلی شما: <b>${formatToman(balance)}</b> تومان`,
    "",
    `${premiumEmoji(PremiumEmoji.OUTBOUND_USAGE_SUSPEND)} موجودی کیف پول شما کمتر از <b>${formatOutboundVolumeText(PANEL_USAGE_LOW_BALANCE_GB)}</b> شده و <b>کاربران پنل شما</b> به‌زودی غیرفعال خواهند شد.`,
    "",
    `${premiumEmoji(PremiumEmoji.WALLET_TOP_UP)} در صورت تمایل به <b>ادامه سرویس</b>، لطفاً کیف پول خود را شارژ کنید:`,
  ].join("\n");
}

export function buildPanelUsageLowBalance5GbMessage(balance) {
  return [
    `${premiumEmoji(PremiumEmoji.TOPUP_DESC)} <b>هشدار: موجودی بسیار کم</b>`,
    "",
    `${premiumEmoji(PremiumEmoji.WALLET_BALANCE)} موجودی فعلی شما: <b>${formatToman(balance)}</b> تومان`,
    "",
    `${premiumEmoji(PremiumEmoji.OUTBOUND_USAGE_SUSPEND)} موجودی کیف پول شما کمتر از <b>${formatOutboundVolumeText(PANEL_USAGE_CRITICAL_BALANCE_GB)}</b> است و <b>کاربران پنل شما</b> به‌زودی به‌دلیل اتمام موجودی غیرفعال می‌شوند.`,
    "",
    `${premiumEmoji(PremiumEmoji.WALLET_TOP_UP)} برای جلوگیری از قطع سرویس، همین حالا کیف پول خود را شارژ کنید:`,
  ].join("\n");
}

export function buildPanelUsageSuspendedMessage() {
  return [
    `${premiumEmoji(PremiumEmoji.OUTBOUND_USAGE_SUSPEND)} <b>کاربران پنل غیرفعال شدند</b>`,
    "",
    `${premiumEmoji(PremiumEmoji.WALLET_BALANCE)} موجودی کیف پول شما <b>تمام شده</b> و تمام <b>کاربران فعال</b> اکانت ادمین شما در پنل به‌صورت خودکار غیرفعال شدند.`,
    "",
    `${premiumEmoji(PremiumEmoji.WALLET_TOP_UP)} پس از <b>شارژ کیف پول</b>، کاربران غیرفعال‌شده به‌صورت خودکار دوباره فعال خواهند شد:`,
  ].join("\n");
}
