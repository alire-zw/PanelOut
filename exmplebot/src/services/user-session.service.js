import { redis } from "../db/redis.js";
import { clearAdminSession } from "./admin-session.service.js";

const PREFIX = "user:session:";
const TTL_SECONDS = 1800;

export const UserSessionAction = {
  AWAITING_RIAL_AMOUNT: "awaiting_rial_amount",
  AWAITING_RIAL_RECEIPT: "awaiting_rial_receipt",
  AWAITING_OUTBOUND_VOLUME_RECEIPT: "awaiting_outbound_volume_receipt",
  AWAITING_PANEL_TRIAL_USERNAME: "awaiting_panel_trial_username",
  AWAITING_PANEL_UNLIMITED_USERNAME: "awaiting_panel_unlimited_username",
  AWAITING_PANEL_USAGE_USERNAME: "awaiting_panel_usage_username",
};

export async function beginRialAmountSession(userId, prompt) {
  await clearUserSession(userId);
  await clearAdminSession(userId);
  await setUserSession(userId, {
    action: UserSessionAction.AWAITING_RIAL_AMOUNT,
    promptChatId: prompt.chatId,
    promptMessageId: prompt.messageId,
  });
}

export async function setUserSession(userId, data) {
  const payload =
    typeof data === "string"
      ? JSON.stringify({ action: data })
      : JSON.stringify(data);

  await redis.set(`${PREFIX}${userId}`, payload, "EX", TTL_SECONDS);
}

export async function getUserSession(userId) {
  const raw = await redis.get(`${PREFIX}${userId}`);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return { action: raw };
  }
}

export async function clearUserSession(userId) {
  await redis.del(`${PREFIX}${userId}`);
}

export async function beginPanelTrialUsernameSession(userId, prompt) {
  await clearUserSession(userId);
  await clearAdminSession(userId);
  await setUserSession(userId, {
    action: UserSessionAction.AWAITING_PANEL_TRIAL_USERNAME,
    promptChatId: prompt.chatId,
    promptMessageId: prompt.messageId,
  });
}

export async function beginPanelUnlimitedUsernameSession(userId, prompt, purchase) {
  await clearUserSession(userId);
  await clearAdminSession(userId);
  await setUserSession(userId, {
    action: UserSessionAction.AWAITING_PANEL_UNLIMITED_USERNAME,
    promptChatId: prompt.chatId,
    promptMessageId: prompt.messageId,
    purchaseCount: purchase.count,
    purchaseMaxUsers: purchase.maxUsers,
    purchaseDays: purchase.days,
  });
}

export async function beginPanelUsageUsernameSession(userId, prompt, { provisioning = false } = {}) {
  await clearUserSession(userId);
  await clearAdminSession(userId);
  await setUserSession(userId, {
    action: UserSessionAction.AWAITING_PANEL_USAGE_USERNAME,
    promptChatId: prompt.chatId,
    promptMessageId: prompt.messageId,
    provisioning: provisioning || undefined,
  });
}

export async function markPanelUsageProvisioning(userId, prompt) {
  await setUserSession(userId, {
    action: UserSessionAction.AWAITING_PANEL_USAGE_USERNAME,
    promptChatId: prompt.chatId,
    promptMessageId: prompt.messageId,
    provisioning: true,
  });
}

export async function beginOutboundVolumeReceiptSession(userId, data) {
  await clearUserSession(userId);
  await setUserSession(userId, {
    action: UserSessionAction.AWAITING_OUTBOUND_VOLUME_RECEIPT,
    ...data,
  });
}
