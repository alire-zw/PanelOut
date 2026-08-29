import { ServiceType } from "../constants/service-types.js";
import { MANAGE_SERVICES_MAX_LIST_LABEL } from "../constants/manage-services.js";
import { formatOutboundVolumeText } from "../lib/outbound-volume-steps.js";
import { formatTrafficGb } from "../lib/traffic-format.js";

export function escapeManageServicesHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function getServiceTypeLabel(serviceType) {
  switch (serviceType) {
    case ServiceType.OUTBOUND_VOLUME:
      return "اوتباند حجمی";
    case ServiceType.OUTBOUND_USAGE:
      return "اوتباند به‌ازای مصرف";
    case ServiceType.PANEL_TRIAL:
      return "پنل تست";
    case ServiceType.PANEL_UNLIMITED:
      return "پنل نامحدود";
    case ServiceType.PANEL_USAGE:
      return "پنل به‌ازای مصرف";
    default:
      return "سرویس";
  }
}

export function getServiceTypeShortLabel(serviceType) {
  switch (serviceType) {
    case ServiceType.OUTBOUND_VOLUME:
      return "حجمی";
    case ServiceType.OUTBOUND_USAGE:
      return "مصرفی";
    case ServiceType.PANEL_TRIAL:
      return "تست";
    case ServiceType.PANEL_UNLIMITED:
      return "نامحدود";
    case ServiceType.PANEL_USAGE:
      return "پنل مصرفی";
    default:
      return "سرویس";
  }
}

export function getSubscriptionDisplayName(subscription) {
  return String(subscription?.remark || subscription?.clientEmail || "سرویس").trim();
}

export function truncateListLabel(text, maxLen = MANAGE_SERVICES_MAX_LIST_LABEL) {
  const value = String(text || "").trim();

  if (value.length <= maxLen) {
    return value;
  }

  return `${value.slice(0, Math.max(1, maxLen - 3))}...`;
}

export function buildServiceListButtonLabel(subscription) {
  const name = getSubscriptionDisplayName(subscription);
  const typeShort = getServiceTypeShortLabel(subscription.serviceType);
  return truncateListLabel(`${typeShort} · ${name}`);
}

export function formatVolumeGbLabel(volumeGb, { unlimited = false } = {}) {
  if (unlimited || volumeGb === 0) {
    return "نامحدود";
  }

  return formatOutboundVolumeText(volumeGb);
}

export function formatUsedTrafficLabel(bytes) {
  return `${formatTrafficGb(bytes ?? 0n)} گیگ`;
}

export function formatRemainingTrafficLabel(remainingBytes, { unlimited = false } = {}) {
  if (unlimited || remainingBytes == null) {
    return "نامحدود";
  }

  return `${formatTrafficGb(remainingBytes)} گیگ`;
}

export function formatExpiryDaysLabel(expireIso) {
  if (!expireIso) {
    return "∞";
  }

  const expiryMs = new Date(expireIso).getTime();

  if (!Number.isFinite(expiryMs) || expiryMs <= 0) {
    return "∞";
  }

  const remainingMs = Math.max(0, expiryMs - Date.now());
  const days = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));

  return remainingMs <= 0 ? "0" : String(days);
}
