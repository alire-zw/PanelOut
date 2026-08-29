import { PremiumEmoji, premiumEmoji } from "../constants/emojis.js";
import { formatOutboundVolumeText } from "../lib/outbound-volume-steps.js";
import { formatTrafficGb } from "../lib/traffic-format.js";

function buildTitle(thresholdGb) {
  if (thresholdGb <= 5) {
    return "هشدار: حجم بسیار کم";
  }

  if (thresholdGb <= 10) {
    return "حجم پکیج رو به اتمام است";
  }

  return "حجم پکیج در حال اتمام است";
}

export function buildOutboundVolumeLowRemainingMessage({
  subscriptionName,
  remainingBytes,
  thresholdGb,
}) {
  const remainingGb = formatTrafficGb(remainingBytes);

  return [
    `${premiumEmoji(PremiumEmoji.TOPUP_DESC)} <b>${buildTitle(thresholdGb)}</b>`,
    "",
    `${premiumEmoji(PremiumEmoji.MANAGE_SERVICES)} اشتراک: <b>${subscriptionName}</b>`,
    `${premiumEmoji(PremiumEmoji.VOLUME_PACKAGE)} حجم باقی‌مانده: <b>${remainingGb}</b> گیگابایت`,
    "",
    `${premiumEmoji(PremiumEmoji.OUTBOUND_USAGE_SUSPEND)} حجم پکیج <b>اوتباند حجمی</b> شما به <b>${formatOutboundVolumeText(thresholdGb)}</b> رسیده است. برای ادامه استفاده، پکیج جدید تهیه کنید.`,
    "",
    `${premiumEmoji(PremiumEmoji.VOLUME_PACKAGE_BTN)} از دکمه زیر می‌توانید <b>پکیج حجمی جدید</b> خریداری کنید:`,
  ].join("\n");
}
