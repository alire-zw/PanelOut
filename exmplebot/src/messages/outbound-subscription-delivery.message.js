import { ServiceType } from "../constants/service-types.js";
import { formatOutboundVolumeText } from "../lib/outbound-volume-steps.js";
import { PremiumEmoji, premiumEmoji } from "../constants/emojis.js";

function formatSubscriptionVolumeLabel(volumeGb, serviceType) {
  if (serviceType === ServiceType.OUTBOUND_USAGE || volumeGb === 0) {
    return "نامحدود (به‌ازای مصرف)";
  }

  return formatOutboundVolumeText(volumeGb);
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildOutboundSubscriptionDeliveryMessage({
  clientEmail,
  subscriptionUrl,
  volumeGb,
  serviceType = ServiceType.OUTBOUND_VOLUME,
}) {
  const volumeLabel = formatSubscriptionVolumeLabel(volumeGb, serviceType);
  return [
    `${premiumEmoji(PremiumEmoji.WALLET_TOP_UP)} <b>اوتباند</b> شما با موفقیت در <b>پنل</b> ساخته شد و <b>آماده استفاده</b> است.`,
    "",
    `${premiumEmoji(PremiumEmoji.MANAGE_SERVICES)} از طریق <b>لینک ساب‌اسکریپشن</b> زیر می‌توانید <b>کانفیگ‌ها</b> و آدرس‌های مربوط به <b>لوکیشن‌های مختلف</b> را دریافت کرده و داخل <b>پنل خود</b> اضافه و مدیریت کنید.`,
    "",
    `${premiumEmoji(PremiumEmoji.STATS_DESC)} <b>نام اشتراک:</b> <b>${escapeHtml(clientEmail)}</b>`,
    `${premiumEmoji(PremiumEmoji.STATS_DESC)} <b>حجم:</b> <b>${volumeLabel}</b>`,
    "",
    `${premiumEmoji(PremiumEmoji.TOPUP_DESC)} <b>لینک ساب‌اسکریپشن:</b>`,
    `<b>${escapeHtml(subscriptionUrl)}</b>`,
    "",
    `${premiumEmoji(PremiumEmoji.SUBSCRIPTION_ADDRESS_TIP)} در بخش <b>Address</b> می‌توانید از <b>دامنه</b> استفاده کنید و در صورت نیاز امکان وارد کردن <b>IP</b> پشت دامنه نیز وجود دارد (استفاده از <b>دامنه</b> توصیه می‌شود).`,
    "",
    `${premiumEmoji(PremiumEmoji.SUBSCRIPTION_LOCATION_TIP)} توجه داشته باشید ممکن است برخی <b>لوکیشن‌ها</b> به سرور شما پینگ ندهند؛ در این صورت از <b>لوکیشن‌های دیگر</b> استفاده کنید. اگر هیچ لوکیشنی پاسخ نداد، ابتدا <b>وضعیت سرور</b> خود را بررسی کرده و در صورت ادامه مشکل با <b>پشتیبانی</b> در ارتباط باشید.`,
  ].join("\n");
}
