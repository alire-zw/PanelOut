import { ServiceType, SubscriptionPanelStatus } from "../constants/service-types.js";
import { getPanelUserRemainingBytes } from "../lib/outbound-volume-remaining.js";

export const ManageServiceVisualStatus = {
  ACTIVE: "active",
  SUSPENDED: "suspended",
  DEACTIVATED: "deactivated",
  INACTIVE: "inactive",
  EXPIRED: "expired",
  UNKNOWN: "unknown",
};

export function resolveManageServiceStatus(subscription, live) {
  if (subscription.panelStatus === SubscriptionPanelStatus.DEACTIVATED) {
    return ManageServiceVisualStatus.DEACTIVATED;
  }

  if (subscription.panelStatus === SubscriptionPanelStatus.SUSPENDED) {
    return ManageServiceVisualStatus.SUSPENDED;
  }

  if (!live?.success) {
    return ManageServiceVisualStatus.UNKNOWN;
  }

  if (live.kind === "user") {
    const user = live.data || {};
    const status = String(user.status || "").toLowerCase();

    if (status === "disabled" || status === "limited") {
      return ManageServiceVisualStatus.INACTIVE;
    }

    if (status === "expired") {
      return ManageServiceVisualStatus.EXPIRED;
    }

    const expireIso = user.expire;
    if (expireIso) {
      const expiryMs = new Date(expireIso).getTime();
      if (Number.isFinite(expiryMs) && expiryMs > 0 && Date.now() > expiryMs) {
        return ManageServiceVisualStatus.EXPIRED;
      }
    }

    if (subscription.serviceType === ServiceType.OUTBOUND_VOLUME && subscription.volumeGb > 0) {
      const remaining = getPanelUserRemainingBytes(user);
      if (remaining === 0n) {
        return ManageServiceVisualStatus.EXPIRED;
      }
    }

    return ManageServiceVisualStatus.ACTIVE;
  }

  if (live.kind === "admin") {
    const status = String(live.data?.status || "").toLowerCase();

    if (status && status !== "active") {
      return ManageServiceVisualStatus.INACTIVE;
    }

    return ManageServiceVisualStatus.ACTIVE;
  }

  return ManageServiceVisualStatus.UNKNOWN;
}

export function getManageServiceStatusLabel(status) {
  switch (status) {
    case ManageServiceVisualStatus.ACTIVE:
      return "🟢 فعال";
    case ManageServiceVisualStatus.SUSPENDED:
      return "🟠 تعلیق (موجودی)";
    case ManageServiceVisualStatus.DEACTIVATED:
      return "🔴 غیرفعال";
    case ManageServiceVisualStatus.INACTIVE:
      return "🔴 خاموش";
    case ManageServiceVisualStatus.EXPIRED:
      return "🔴 منقضی / تمام‌شده";
    default:
      return "⏳ نامشخص";
  }
}

export function getListButtonStyle(status) {
  if (status === ManageServiceVisualStatus.ACTIVE) {
    return "success";
  }

  if (
    status === ManageServiceVisualStatus.DEACTIVATED ||
    status === ManageServiceVisualStatus.SUSPENDED ||
    status === ManageServiceVisualStatus.INACTIVE ||
    status === ManageServiceVisualStatus.EXPIRED
  ) {
    return "danger";
  }

  return null;
}

export function resolveManageServiceToggleAction(subscription, status) {
  if (subscription.panelStatus === SubscriptionPanelStatus.DEACTIVATED) {
    return null;
  }

  switch (subscription.serviceType) {
    case ServiceType.OUTBOUND_VOLUME:
      if (status === ManageServiceVisualStatus.INACTIVE) {
        return "enable_volume";
      }
      if (status === ManageServiceVisualStatus.ACTIVE) {
        return "disable_volume";
      }
      return null;

    case ServiceType.OUTBOUND_USAGE:
      if (subscription.panelStatus === SubscriptionPanelStatus.SUSPENDED) {
        return "reactivate_usage";
      }
      if (status === ManageServiceVisualStatus.ACTIVE) {
        return "deactivate_usage";
      }
      return null;

    case ServiceType.PANEL_USAGE:
      if (subscription.panelStatus === SubscriptionPanelStatus.SUSPENDED) {
        return "reactivate_panel_usage";
      }
      if (status === ManageServiceVisualStatus.ACTIVE) {
        return "deactivate_panel_usage";
      }
      return null;

    case ServiceType.PANEL_TRIAL:
    case ServiceType.PANEL_UNLIMITED:
      if (status === ManageServiceVisualStatus.INACTIVE) {
        return "enable_admin";
      }
      if (status === ManageServiceVisualStatus.ACTIVE) {
        return "disable_admin";
      }
      return null;

    default:
      return null;
  }
}

export function getToggleButtonLabel(action) {
  switch (action) {
    case "enable_volume":
    case "enable_admin":
    case "reactivate_usage":
    case "reactivate_panel_usage":
      return "فعال‌سازی";
    case "disable_volume":
    case "disable_admin":
    case "deactivate_usage":
    case "deactivate_panel_usage":
      return "غیرفعال کردن";
    default:
      return null;
  }
}
