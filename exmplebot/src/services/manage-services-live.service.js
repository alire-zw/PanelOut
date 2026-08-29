import { ServiceType } from "../constants/service-types.js";
import {
  getCachedManageServiceLive,
  setCachedManageServiceLive,
} from "./manage-services-cache.service.js";
import { fetchPasarGuardUser } from "./pasarguard-provision.service.js";
import { fetchPanelUsageAdmin } from "./panel-usage-provision.service.js";

const RETRIES = 2;
const RETRY_DELAY_MS = 450;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchOutboundUserLive(subscription) {
  let lastError = "خطا در دریافت از پنل";

  for (let attempt = 0; attempt < RETRIES; attempt += 1) {
    try {
      const user = await fetchPasarGuardUser(
        subscription.server,
        subscription.clientEmail,
      );

      return { success: true, kind: "user", data: user };
    } catch (err) {
      lastError = err.message || lastError;

      if (attempt < RETRIES - 1) {
        await delay(RETRY_DELAY_MS);
      }
    }
  }

  return { success: false, error: lastError };
}

async function fetchPanelAdminLive(subscription) {
  let lastError = "خطا در دریافت از پنل";

  for (let attempt = 0; attempt < RETRIES; attempt += 1) {
    try {
      const admin = await fetchPanelUsageAdmin(
        subscription.server,
        subscription.clientEmail,
      );

      return { success: true, kind: "admin", data: admin };
    } catch (err) {
      lastError = err.message || lastError;

      if (attempt < RETRIES - 1) {
        await delay(RETRY_DELAY_MS);
      }
    }
  }

  return { success: false, error: lastError };
}

export async function fetchManageServiceLive(subscription, { refresh = false } = {}) {
  if (!subscription?.server) {
    return { success: false, error: "سرور یافت نشد" };
  }

  const subscriptionId = String(subscription.id);

  if (!refresh) {
    const cached = await getCachedManageServiceLive(subscriptionId);

    if (cached) {
      return cached;
    }
  }

  let live;

  if (
    subscription.serviceType === ServiceType.OUTBOUND_VOLUME ||
    subscription.serviceType === ServiceType.OUTBOUND_USAGE
  ) {
    live = await fetchOutboundUserLive(subscription);
  } else if (
    subscription.serviceType === ServiceType.PANEL_TRIAL ||
    subscription.serviceType === ServiceType.PANEL_UNLIMITED ||
    subscription.serviceType === ServiceType.PANEL_USAGE
  ) {
    live = await fetchPanelAdminLive(subscription);
  } else {
    return { success: false, error: "نوع سرویس پشتیبانی نمی‌شود" };
  }

  await setCachedManageServiceLive(subscriptionId, live);

  return live;
}

export async function fetchManageServicesLiveBatch(subscriptions, { refresh = false } = {}) {
  const results = await Promise.allSettled(
    subscriptions.map((subscription) =>
      fetchManageServiceLive(subscription, { refresh }),
    ),
  );

  return subscriptions.map((subscription, index) => {
    const result = results[index];

    if (result.status === "fulfilled") {
      return { subscription, live: result.value };
    }

    return {
      subscription,
      live: { success: false, error: result.reason?.message || "خطا در اتصال" },
    };
  });
}
