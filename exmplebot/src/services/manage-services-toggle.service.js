import {
  ServiceType,
  SubscriptionPanelStatus,
} from "../constants/service-types.js";
import { prisma } from "../db/prisma.js";
import { logger } from "../lib/logger.js";
import {
  disableAllPanelAdminActiveUsers,
  setPanelAdminStatus,
} from "./panel-usage-provision.service.js";
import { reactivatePanelUsageSubscriptionOnPanel } from "./panel-usage-billing.service.js";
import { setPasarGuardUserStatus } from "./pasarguard-provision.service.js";
import { reactivateSubscriptionOnPanel } from "./outbound-usage-billing.service.js";
import {
  buildOutboundUsageBillingContext,
  buildPanelUsageBillingContext,
  getSubscriptionPricing,
} from "./subscription-pricing.service.js";
import { findUserSubscriptionById } from "./user-subscription.service.js";
import { getUserByTelegramId } from "./user.service.js";
import { fetchManageServiceLive } from "./manage-services-live.service.js";

export async function handleManageServiceToggle(from, subscriptionId) {
  const subscription = await findUserSubscriptionById(from.id, subscriptionId);

  if (!subscription) {
    return { ok: false, code: "NOT_FOUND" };
  }

  const user = await getUserByTelegramId(from.id);
  const balance = user?.balance ?? 0n;
  const pricing = await getSubscriptionPricing();
  const panelReactivateMinIrt = buildPanelUsageBillingContext(pricing).reactivateMinIrt;
  const outboundReactivateMinIrt = buildOutboundUsageBillingContext(pricing).reactivateMinIrt;

  switch (subscription.serviceType) {
    case ServiceType.OUTBOUND_VOLUME:
      return toggleOutboundVolume(subscription);

    case ServiceType.OUTBOUND_USAGE:
      return toggleOutboundUsage(from, subscription, balance, outboundReactivateMinIrt);

    case ServiceType.PANEL_USAGE:
      return togglePanelUsage(from, subscription, balance, panelReactivateMinIrt);

    case ServiceType.PANEL_TRIAL:
    case ServiceType.PANEL_UNLIMITED:
      return togglePanelAdmin(subscription);

    default:
      return { ok: false, code: "UNSUPPORTED" };
  }
}

async function toggleOutboundVolume(subscription) {
  if (subscription.panelStatus === SubscriptionPanelStatus.DEACTIVATED) {
    return { ok: false, code: "DEACTIVATED" };
  }

  const isSuspended =
    subscription.panelStatus === SubscriptionPanelStatus.SUSPENDED;

  try {
    if (isSuspended) {
      await setPasarGuardUserStatus(
        subscription.server,
        subscription.clientEmail,
        "active",
      );

      await prisma.userSubscription.update({
        where: { id: subscription.id },
        data: { panelStatus: SubscriptionPanelStatus.ACTIVE },
      });
    } else {
      await setPasarGuardUserStatus(
        subscription.server,
        subscription.clientEmail,
        "disabled",
      );

      await prisma.userSubscription.update({
        where: { id: subscription.id },
        data: { panelStatus: SubscriptionPanelStatus.SUSPENDED },
      });
    }

    return { ok: true };
  } catch (err) {
    logger.error("manage-services", "toggle outbound volume failed", {
      subscriptionId: String(subscription.id),
      error: err.message,
    });

    return { ok: false, code: "PANEL_ERROR", message: err.message };
  }
}

async function toggleOutboundUsage(from, subscription, balance, reactivateMinIrt) {
  if (subscription.panelStatus === SubscriptionPanelStatus.DEACTIVATED) {
    return { ok: false, code: "DEACTIVATED" };
  }

  if (subscription.panelStatus === SubscriptionPanelStatus.SUSPENDED) {
    if (balance < reactivateMinIrt) {
      return { ok: false, code: "LOW_BALANCE" };
    }

    try {
      await reactivateSubscriptionOnPanel(subscription, subscription.server);
      return { ok: true };
    } catch (err) {
      logger.error("manage-services", "reactivate outbound usage failed", {
        subscriptionId: String(subscription.id),
        error: err.message,
      });

      return { ok: false, code: "PANEL_ERROR", message: err.message };
    }
  }

  try {
    await setPasarGuardUserStatus(
      subscription.server,
      subscription.clientEmail,
      "disabled",
    );

    await prisma.userSubscription.update({
      where: { id: subscription.id },
      data: { panelStatus: SubscriptionPanelStatus.DEACTIVATED },
    });

    logger.info("manage-services", "outbound usage deactivated", {
      userId: String(from.id),
      subscriptionId: String(subscription.id),
      clientEmail: subscription.clientEmail,
    });

    return { ok: true };
  } catch (err) {
    logger.error("manage-services", "deactivate outbound usage failed", {
      subscriptionId: String(subscription.id),
      error: err.message,
    });

    return { ok: false, code: "PANEL_ERROR", message: err.message };
  }
}

async function togglePanelUsage(from, subscription, balance, reactivateMinIrt) {
  if (subscription.panelStatus === SubscriptionPanelStatus.DEACTIVATED) {
    return { ok: false, code: "DEACTIVATED" };
  }

  if (subscription.panelStatus === SubscriptionPanelStatus.SUSPENDED) {
    if (balance < reactivateMinIrt) {
      return { ok: false, code: "LOW_BALANCE" };
    }

    try {
      await reactivatePanelUsageSubscriptionOnPanel(
        subscription,
        subscription.server,
      );
      return { ok: true };
    } catch (err) {
      logger.error("manage-services", "reactivate panel usage failed", {
        subscriptionId: String(subscription.id),
        error: err.message,
      });

      return { ok: false, code: "PANEL_ERROR", message: err.message };
    }
  }

  try {
    await disableAllPanelAdminActiveUsers(
      subscription.server,
      subscription.clientEmail,
    );

    await prisma.userSubscription.update({
      where: { id: subscription.id },
      data: { panelStatus: SubscriptionPanelStatus.DEACTIVATED },
    });

    logger.info("manage-services", "panel usage deactivated", {
      userId: String(from.id),
      subscriptionId: String(subscription.id),
      username: subscription.clientEmail,
    });

    return { ok: true, deactivated: true };
  } catch (err) {
    logger.error("manage-services", "deactivate panel usage failed", {
      subscriptionId: String(subscription.id),
      error: err.message,
    });

    return { ok: false, code: "PANEL_ERROR", message: err.message };
  }
}

async function togglePanelAdmin(subscription) {
  try {
    const live = await fetchManageServiceLive(subscription);
    const currentStatus = String(live?.data?.status || "active").toLowerCase();
    const nextStatus = currentStatus === "active" ? "disabled" : "active";

    await setPanelAdminStatus(
      subscription.server,
      subscription.clientEmail,
      nextStatus,
    );

    await prisma.userSubscription.update({
      where: { id: subscription.id },
      data: {
        panelStatus:
          nextStatus === "disabled"
            ? SubscriptionPanelStatus.SUSPENDED
            : SubscriptionPanelStatus.ACTIVE,
      },
    });

    return { ok: true };
  } catch (err) {
    logger.error("manage-services", "toggle panel admin failed", {
      subscriptionId: String(subscription.id),
      error: err.message,
    });

    return { ok: false, code: "PANEL_ERROR", message: err.message };
  }
}
