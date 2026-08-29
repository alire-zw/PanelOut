import { PremiumEmoji, premiumEmoji } from "../constants/emojis.js";
import { ServiceType } from "../constants/service-types.js";
import { getPanelUserRemainingBytes } from "../lib/outbound-volume-remaining.js";
import {
  escapeManageServicesHtml,
  formatExpiryDaysLabel,
  formatRemainingTrafficLabel,
  formatUsedTrafficLabel,
  formatVolumeGbLabel,
  getServiceTypeLabel,
  getSubscriptionDisplayName,
} from "../lib/manage-services-format.js";
import {
  getManageServiceStatusLabel,
  resolveManageServiceStatus,
} from "../lib/manage-services-status.js";
import { buildFullSubscriptionUrl } from "../services/pasarguard-provision.service.js";
import { formatToman } from "./wallet.message.js";

export function buildManageServicesListMessage(updatedAt, totalCount, { page, totalPages } = {}) {
  if (totalCount === 0) {
    return [
      `${premiumEmoji(PremiumEmoji.MANAGE_SERVICES)} <b>مدیریت سرویس‌ها</b>`,
      "",
      "هنوز سرویسی ثبت نشده است. از بخش <b>تهیه سرویس جدید</b> می‌توانید سرویس موردنظر خود را فعال کنید.",
      "",
      `${premiumEmoji(PremiumEmoji.STATS_UPDATED)} آخرین بروزرسانی: ${updatedAt}`,
    ].join("\n");
  }

  const pageLine =
    totalPages > 1
      ? `\n${premiumEmoji(PremiumEmoji.STATS_DESC)} صفحه <b>${page + 1}</b> از <b>${totalPages}</b> — <b>${totalCount}</b> سرویس`
      : `\n${premiumEmoji(PremiumEmoji.STATS_DESC)} <b>${totalCount}</b> سرویس فعال و غیرفعال`;

  return [
    `${premiumEmoji(PremiumEmoji.MANAGE_SERVICES)} <b>مدیریت سرویس‌ها</b>`,
    "",
    "لیست تمام سرویس‌های شما با <b>وضعیت زنده</b> از پنل. روی هر مورد کلیک کنید تا جزئیات و مدیریت آن را ببینید.",
    pageLine,
    "",
    `${premiumEmoji(PremiumEmoji.STATS_UPDATED)} آخرین بروزرسانی: ${updatedAt}`,
  ].join("\n");
}

export function buildManageServicesLoadingMessage() {
  return manageServicesProcessingMessage;
}

export const manageServicesProcessingMessage = [
  `${premiumEmoji(PremiumEmoji.SUBSCRIPTION_BUILDING)} <b>در حال بررسی سرویس‌های شما به‌صورت زنده هستیم، لطفاً صبر کنید...</b>`,
].join("\n");

export const manageServicesDetailProcessingMessage = [
  `${premiumEmoji(PremiumEmoji.SUBSCRIPTION_BUILDING)} <b>در حال دریافت اطلاعات سرویس از پنل...</b>`,
  "",
  "لطفاً چند لحظه صبر کنید.",
].join("\n");

function appendOutboundUserDetailLines(lines, subscription, live) {
  const user = live?.data || {};
  const unlimited = subscription.serviceType === ServiceType.OUTBOUND_USAGE;
  const remainingBytes = unlimited ? null : getPanelUserRemainingBytes(user);
  const usedBytes = BigInt(user.used_traffic ?? 0);

  lines.push(
    `${premiumEmoji(PremiumEmoji.STATS_DESC)} <b>مصرف شده:</b> ${formatUsedTrafficLabel(usedBytes)}`,
    `${premiumEmoji(PremiumEmoji.VOLUME_PACKAGE)} <b>حجم باقی‌مانده:</b> ${formatRemainingTrafficLabel(remainingBytes, { unlimited })}`,
  );

  if (!unlimited && subscription.volumeGb > 0) {
    lines.push(
      `${premiumEmoji(PremiumEmoji.VOLUME_PACKAGE)} <b>حجم خریداری‌شده:</b> ${formatVolumeGbLabel(subscription.volumeGb)}`,
    );
  }

  const subUrl = buildFullSubscriptionUrl(subscription.server, subscription.connectionLink);
  if (subUrl) {
    lines.push(
      "",
      `${premiumEmoji(PremiumEmoji.SUBSCRIPTION_ADDRESS_TIP)} <b>لینک ساب‌اسکریپشن:</b>`,
      `<pre><code>${escapeManageServicesHtml(subUrl)}</code></pre>`,
    );
  }
}

function appendPanelAdminDetailLines(lines, subscription, live) {
  if (subscription.serviceType === ServiceType.PANEL_UNLIMITED && subscription.volumeGb > 0) {
    lines.push(
      `${premiumEmoji(PremiumEmoji.VOLUME_PACKAGE)} <b>تعداد اشتراک:</b> ${Number(subscription.volumeGb).toLocaleString("en-US")} عدد`,
    );
  }

  if (subscription.serviceType === ServiceType.PANEL_TRIAL) {
    lines.push(
      `${premiumEmoji(PremiumEmoji.VOLUME_PACKAGE)} <b>حجم تست:</b> ${formatVolumeGbLabel(subscription.volumeGb)}`,
    );
  }

  if (live?.success) {
    lines.push(
      `${premiumEmoji(PremiumEmoji.INVALID_THINKING)} جزئیات ورود و مصرف را از دکمه‌های زیر مشاهده کنید.`,
    );
  }
}

export function buildManageServiceDetailMessage({
  subscription,
  live,
  updatedAt,
  balance = 0n,
  credentials = {},
}) {
  const name = getSubscriptionDisplayName(subscription);
  const typeLabel = getServiceTypeLabel(subscription.serviceType);
  const status = resolveManageServiceStatus(subscription, live);
  const statusLabel = getManageServiceStatusLabel(status);

  const lines = [
    `${premiumEmoji(PremiumEmoji.MANAGE_SERVICES)} <b>جزئیات سرویس</b>`,
    "",
    `${premiumEmoji(PremiumEmoji.STATS_DESC)} <b>نوع:</b> ${typeLabel}`,
    `${premiumEmoji(PremiumEmoji.STATS_DESC)} <b>نام:</b> <code>${escapeManageServicesHtml(name)}</code>`,
    `${premiumEmoji(PremiumEmoji.SERVICE_ACTIVE)} <b>وضعیت:</b> ${statusLabel}`,
    "",
  ];

  if (!live?.success) {
    lines.push(
      `${premiumEmoji(PremiumEmoji.INVALID_CONFUSED)} اطلاعات زنده از پنل دریافت نشد. دکمه <b>بروزرسانی</b> را امتحان کنید.`,
    );
  } else if (
    subscription.serviceType === ServiceType.OUTBOUND_VOLUME ||
    subscription.serviceType === ServiceType.OUTBOUND_USAGE
  ) {
    appendOutboundUserDetailLines(lines, subscription, live);
  } else {
    appendPanelAdminDetailLines(lines, subscription, live);
  }

  if (
    subscription.serviceType === ServiceType.OUTBOUND_USAGE ||
    subscription.serviceType === ServiceType.PANEL_USAGE
  ) {
    if (subscription.serviceType === ServiceType.OUTBOUND_USAGE) {
      lines.push(
        "",
        `${premiumEmoji(PremiumEmoji.WALLET)} <b>موجودی کیف پول:</b> ${formatToman(balance)} تومان`,
      );
    }
  }

  lines.push(
    "",
    `${premiumEmoji(PremiumEmoji.STATS_UPDATED)} آخرین بروزرسانی: ${updatedAt}`,
  );

  return lines.join("\n");
}

export function buildManageServiceDetailStatValues(subscription, live) {
  const status = resolveManageServiceStatus(subscription, live);
  const statusLabel = getManageServiceStatusLabel(status);

  if (
    subscription.serviceType === ServiceType.OUTBOUND_VOLUME ||
    subscription.serviceType === ServiceType.OUTBOUND_USAGE
  ) {
    const user = live?.data || {};
    const unlimited = subscription.serviceType === ServiceType.OUTBOUND_USAGE;
    const remainingBytes = unlimited ? null : getPanelUserRemainingBytes(user);

    return {
      statusLabel,
      volumeLabel: formatRemainingTrafficLabel(remainingBytes, { unlimited }),
      usedLabel: formatUsedTrafficLabel(user.used_traffic ?? 0),
      daysLabel: formatExpiryDaysLabel(user.expire),
    };
  }

  const usedBytes = live?.data?.used_traffic ?? 0;

  return {
    statusLabel,
    volumeLabel:
      subscription.serviceType === ServiceType.PANEL_UNLIMITED
        ? `${Number(subscription.volumeGb || 0).toLocaleString("en-US")} اشتراک`
        : formatVolumeGbLabel(subscription.volumeGb),
    usedLabel: formatUsedTrafficLabel(usedBytes),
    daysLabel: statusLabel,
  };
}

export function buildManageServiceToggleAlert(code) {
  switch (code) {
    case "LOW_BALANCE":
      return "موجودی کیف پول برای فعال‌سازی مجدد کافی نیست.";
    case "DEACTIVATED":
      return "این سرویس قبلاً غیرفعال شده و قابل تغییر نیست.";
    case "NOT_FOUND":
      return "سرویس یافت نشد.";
    case "PANEL_ERROR":
      return "خطا در ارتباط با پنل. دوباره تلاش کنید.";
    case "UNSUPPORTED":
      return "این نوع سرویس قابل مدیریت نیست.";
    default:
      return "عملیات ناموفق بود.";
  }
}
