import { MANAGE_SERVICES_PAGE_SIZE } from "../constants/manage-services.js";
import { ServiceType } from "../constants/service-types.js";
import {
  buildManageServiceDetailMessage,
  buildManageServiceDetailStatValues,
  buildManageServiceToggleAlert,
  buildManageServicesListMessage,
  manageServicesDetailProcessingMessage,
  manageServicesProcessingMessage,
} from "../messages/manage-services.message.js";
import {
  manageServicesDetailProcessingKeyboard,
  manageServicesDetailKeyboard,
  manageServicesEmptyKeyboard,
  manageServicesListKeyboard,
  manageServicesProcessingKeyboard,
} from "../keyboards/manage-services.keyboard.js";
import { formatJalaliDateTime } from "../lib/tehran-time.js";
import {
  fetchManageServiceLive,
  fetchManageServicesLiveBatch,
} from "./manage-services-live.service.js";
import {
  getCachedManageServiceLive,
  invalidateCachedManageServiceLive,
} from "./manage-services-cache.service.js";
import { handleManageServiceToggle } from "./manage-services-toggle.service.js";
import {
  findUserSubscriptionById,
  getUserSubscriptions,
} from "./user-subscription.service.js";
import { getUserByTelegramId, syncUserFromTelegram } from "./user.service.js";

function paginateSubscriptions(subscriptions, page) {
  const totalCount = subscriptions.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / MANAGE_SERVICES_PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const start = safePage * MANAGE_SERVICES_PAGE_SIZE;

  return {
    items: subscriptions.slice(start, start + MANAGE_SERVICES_PAGE_SIZE),
    page: safePage,
    totalPages,
    totalCount,
  };
}

async function resolvePanelCredentials(subscription, user) {
  if (subscription.serviceType === ServiceType.PANEL_USAGE) {
    return { password: user?.panelUsageAdminPassword ?? null };
  }

  if (subscription.serviceType === ServiceType.PANEL_UNLIMITED) {
    return {
      password:
        user?.panelUnlimitedAdminPassword &&
        user?.panelUnlimitedAdminUsername === subscription.clientEmail
          ? user.panelUnlimitedAdminPassword
          : null,
    };
  }

  return { password: null };
}

async function isManageServicesListFullyCached(subscriptions) {
  if (!subscriptions.length) {
    return true;
  }

  const cacheResults = await Promise.all(
    subscriptions.map((subscription) =>
      getCachedManageServiceLive(String(subscription.id)),
    ),
  );

  return cacheResults.every(Boolean);
}

export async function shouldShowManageServicesListLoading(from, page, refresh) {
  if (refresh) {
    return true;
  }

  const subscriptions = await getUserSubscriptions(from.id);
  const { items, totalCount } = paginateSubscriptions(subscriptions, page);

  if (totalCount === 0) {
    return false;
  }

  return !(await isManageServicesListFullyCached(items));
}

export async function shouldShowManageServiceDetailLoading(subscriptionId, refresh) {
  if (refresh) {
    return true;
  }

  const cached = await getCachedManageServiceLive(String(subscriptionId));
  return !cached;
}

export function buildManageServicesProcessingScreen() {
  return {
    text: manageServicesProcessingMessage,
    keyboard: manageServicesProcessingKeyboard(),
  };
}

export function buildManageServiceDetailProcessingScreen() {
  return {
    text: manageServicesDetailProcessingMessage,
    keyboard: manageServicesDetailProcessingKeyboard(),
  };
}

export async function buildManageServicesListScreen(from, page = 0, { refresh = false } = {}) {
  await syncUserFromTelegram(from);

  const subscriptions = await getUserSubscriptions(from.id);
  const { items, page: safePage, totalPages, totalCount } = paginateSubscriptions(
    subscriptions,
    page,
  );
  const updatedAt = formatJalaliDateTime();

  if (totalCount === 0) {
    return {
      text: buildManageServicesListMessage(updatedAt, 0),
      keyboard: manageServicesEmptyKeyboard(),
    };
  }

  const pageItems = await fetchManageServicesLiveBatch(items, { refresh });

  return {
    text: buildManageServicesListMessage(updatedAt, totalCount, {
      page: safePage,
      totalPages,
    }),
    keyboard: manageServicesListKeyboard(pageItems, {
      page: safePage,
      totalPages,
    }),
  };
}

export async function buildManageServiceDetailScreen(
  from,
  subscriptionId,
  listPage = 0,
  { refresh = false } = {},
) {
  await syncUserFromTelegram(from);

  const subscription = await findUserSubscriptionById(from.id, subscriptionId);

  if (!subscription) {
    return buildManageServicesListScreen(from, listPage);
  }

  const [live, user] = await Promise.all([
    fetchManageServiceLive(subscription, { refresh }),
    getUserByTelegramId(from.id),
  ]);

  const credentials = await resolvePanelCredentials(subscription, user);
  const updatedAt = formatJalaliDateTime();
  const stats = buildManageServiceDetailStatValues(subscription, live);

  return {
    text: buildManageServiceDetailMessage({
      subscription,
      live,
      updatedAt,
      balance: user?.balance ?? 0n,
      credentials,
    }),
    keyboard: manageServicesDetailKeyboard({
      subscription,
      live,
      listPage,
      stats,
      credentials,
    }),
  };
}

export async function handleManageServiceToggleScreen(from, subscriptionId, listPage = 0) {
  const result = await handleManageServiceToggle(from, subscriptionId);

  if (result.ok) {
    await invalidateCachedManageServiceLive(subscriptionId);
  }

  if (!result.ok) {
    return {
      alert: buildManageServiceToggleAlert(result.code),
      screen: await buildManageServiceDetailScreen(from, subscriptionId, listPage),
    };
  }

  return {
    alert: null,
    screen: await buildManageServiceDetailScreen(from, subscriptionId, listPage, {
      refresh: true,
    }),
  };
}
