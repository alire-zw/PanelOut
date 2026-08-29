import { redis } from "../db/redis.js";

const PREFIX = "admin:server-session:";
const TTL_SECONDS = 600;

export const ServerSessionMode = {
  ADD: "add",
  EDIT: "edit",
};

export const ADD_STEPS = ["serverName", "panelUrl", "userName", "userPassword", "remark"];

export const ADD_STEP_LABELS = {
  serverName: "نام نمایشی سرور",
  panelUrl: "آدرس پنل PasarGuard (مثلاً https://pasarguard.example.com)",
  userName: "نام کاربری ادمین پنل",
  userPassword: "رمز عبور ادمین پنل",
  remark: "Remark سرور (ابتدای نام اشتراک‌ها — اختیاری، «-» برای رد)",
};

export const EDIT_FIELD_LABELS = {
  serverName: "نام سرور",
  serverIp: "آدرس IP سرور",
  serverDomain: "آدرس پایه پنل",
  port: "پورت پنل",
  remark: "Remark سرور",
  subPublicBaseUrl: "پایه عمومی لینک ساب",
};

export async function setServerSession(userId, session) {
  await redis.set(`${PREFIX}${userId}`, JSON.stringify(session), "EX", TTL_SECONDS);
}

export async function attachServerPrompt(userId, prompt) {
  const session = await getServerSession(userId);

  if (!session) return;

  await setServerSession(userId, {
    ...session,
    promptChatId: prompt.chatId,
    promptMessageId: prompt.messageId,
  });
}

export async function getServerSession(userId) {
  const raw = await redis.get(`${PREFIX}${userId}`);

  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function clearServerSession(userId) {
  await redis.del(`${PREFIX}${userId}`);
}
