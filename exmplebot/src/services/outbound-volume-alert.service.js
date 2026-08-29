import {
  OUTBOUND_VOLUME_ALERT_RESET_GB,
  OUTBOUND_VOLUME_ALERT_THRESHOLDS_GB,
  ServiceType,
  SubscriptionPanelStatus,
} from "../constants/service-types.js";
import { prisma } from "../db/prisma.js";
import { getBotInstance } from "../bot/instance.js";
import { logger } from "../lib/logger.js";
import {
  getPanelUserRemainingBytes,
  isRemainingAtOrBelowGb,
} from "../lib/outbound-volume-remaining.js";
import { GB_BYTES } from "../lib/outbound-usage-billing.js";
import { outboundVolumeLowRemainingKeyboard } from "../keyboards/outbound-volume-low-remaining.keyboard.js";
import { buildOutboundVolumeLowRemainingMessage } from "../messages/outbound-volume-low-remaining.message.js";
import { fetchPasarGuardUser } from "./pasarguard-provision.service.js";

const VOLUME_ALERT_FIELDS = {
  15: "volumeRemaining15GbNotified",
  10: "volumeRemaining10GbNotified",
  5: "volumeRemaining5GbNotified",
};

const volumeAlertReset = {
  volumeRemaining15GbNotified: false,
  volumeRemaining10GbNotified: false,
  volumeRemaining5GbNotified: false,
};

function getSubscriptionDisplayName(subscription) {
  return subscription.remark || subscription.clientEmail;
}

async function sendVolumeAlert(userId, text) {
  const bot = getBotInstance();
  if (!bot) return;

  try {
    await bot.api.sendMessage(Number(userId), text, {
      parse_mode: "HTML",
      reply_markup: outboundVolumeLowRemainingKeyboard(),
      link_preview_options: { is_disabled: true },
    });
  } catch (err) {
    logger.warn("outbound-volume-alert", `notify fail ${userId}`, {
      error: err.message,
    });
  }
}

export async function processOutboundVolumeSubscriptionAlert(subscription) {
  const server = subscription.server;

  if (!server || subscription.volumeGb <= 0) {
    return { notified: 0 };
  }

  let panelUser;

  try {
    panelUser = await fetchPasarGuardUser(server, subscription.clientEmail);
  } catch (err) {
    if (err.status === 404) {
      logger.warn("outbound-volume-alert", "panel user missing", {
        subscriptionId: String(subscription.id),
        clientEmail: subscription.clientEmail,
      });
      return { notified: 0 };
    }

    throw err;
  }

  const remainingBytes = getPanelUserRemainingBytes(panelUser);

  if (remainingBytes === null) {
    return { notified: 0 };
  }

  const resetThresholdBytes = BigInt(OUTBOUND_VOLUME_ALERT_RESET_GB) * GB_BYTES;
  const updates = {};
  let notified = 0;

  if (remainingBytes > resetThresholdBytes) {
    Object.assign(updates, volumeAlertReset);
  } else {
    const subscriptionName = getSubscriptionDisplayName(subscription);

    for (const thresholdGb of OUTBOUND_VOLUME_ALERT_THRESHOLDS_GB) {
      const field = VOLUME_ALERT_FIELDS[thresholdGb];

      if (
        isRemainingAtOrBelowGb(remainingBytes, thresholdGb) &&
        !subscription[field]
      ) {
        await sendVolumeAlert(
          subscription.userId,
          buildOutboundVolumeLowRemainingMessage({
            subscriptionName,
            remainingBytes,
            thresholdGb,
          }),
        );
        updates[field] = true;
        notified += 1;
      }
    }
  }

  if (Object.keys(updates).length > 0) {
    await prisma.userSubscription.update({
      where: { id: subscription.id },
      data: updates,
    });
  }

  return { notified };
}

export async function runOutboundVolumeAlertCycle() {
  const subscriptions = await prisma.userSubscription.findMany({
    where: {
      serviceType: ServiceType.OUTBOUND_VOLUME,
      volumeGb: { gt: 0 },
      panelStatus: SubscriptionPanelStatus.ACTIVE,
    },
    include: { server: true },
  });

  let notified = 0;
  let errors = 0;

  for (const subscription of subscriptions) {
    try {
      const result = await processOutboundVolumeSubscriptionAlert(subscription);
      notified += result.notified;
    } catch (err) {
      errors += 1;
      logger.error("outbound-volume-alert", `sub #${subscription.id} fail`, {
        error: err.message,
      });
    }
  }

  return {
    total: subscriptions.length,
    notified,
    errors,
  };
}
