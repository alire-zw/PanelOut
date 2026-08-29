import { redis } from "../db/redis.js";

const PREFIX = "admin:session:";
const TTL_SECONDS = 300;

export const AdminSessionAction = {
  SET_MASTER_WALLET: "set_master_wallet",
  SET_CARD: "set_card",
  SET_SHEBA: "set_sheba",
  SET_PANEL_UNLIMITED_CAPACITY: "set_panel_unlimited_capacity",
  SET_PANEL_USAGE_PRICE_PER_GB: "set_panel_usage_price_per_gb",
  SET_OUTBOUND_PRICE_PER_GB: "set_outbound_price_per_gb",
  SET_PANEL_UNLIMITED_PRICE_PER_SUB: "set_panel_unlimited_price_per_sub",
  SET_PANEL_UNLIMITED_PRICE_PER_USER: "set_panel_unlimited_price_per_user",
};

export async function setAdminSession(userId, action, returnTo = "payment") {
  await redis.set(
    `${PREFIX}${userId}`,
    JSON.stringify({ action, returnTo }),
    "EX",
    TTL_SECONDS,
  );
}

export async function attachAdminPrompt(userId, prompt) {
  const session = await getAdminSession(userId);

  if (!session) {
    return;
  }

  await redis.set(
    `${PREFIX}${userId}`,
    JSON.stringify({
      ...session,
      promptChatId: prompt.chatId,
      promptMessageId: prompt.messageId,
    }),
    "EX",
    TTL_SECONDS,
  );
}

export async function getAdminSession(userId) {
  const raw = await redis.get(`${PREFIX}${userId}`);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return { action: raw, returnTo: "payment" };
  }
}

export async function clearAdminSession(userId) {
  await redis.del(`${PREFIX}${userId}`);
}
