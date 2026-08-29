import { redis } from "../db/redis.js";

const PREFIX = "admin:channel-session:";
const TTL_SECONDS = 600;

export const ChannelSessionMode = {
  ADD: "add",
  EDIT_LABEL: "edit_label",
};

export async function setChannelSession(userId, session) {
  await redis.set(`${PREFIX}${userId}`, JSON.stringify(session), "EX", TTL_SECONDS);
}

export async function attachChannelPrompt(userId, prompt) {
  const session = await getChannelSession(userId);

  if (!session) return;

  await setChannelSession(userId, {
    ...session,
    promptChatId: prompt.chatId,
    promptMessageId: prompt.messageId,
  });
}

export async function getChannelSession(userId) {
  const raw = await redis.get(`${PREFIX}${userId}`);

  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function clearChannelSession(userId) {
  await redis.del(`${PREFIX}${userId}`);
}
