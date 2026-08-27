import { getSql } from "./postgres.js";
import { getBotApi } from "../bot/api.js";
import { isStaffRole } from "./users.js";
import { log } from "../lib/logger.js";

export const ADMIN_SYSTEM_CHANNEL_SLOTS = Object.freeze([
  "admin_report",
  "purchase_report",
  "notification",
]);

export const CHANNEL_LOCK_SLOTS = Object.freeze([
  "purchase_report",
  "notification",
]);

export const ADMIN_SYSTEM_CHANNEL_LABELS = Object.freeze({
  admin_report: "کانال گزارش ادمین",
  purchase_report: "کانال گزارشات خرید",
  notification: "کانال اطلاع‌رسانی",
});

export const ADMIN_SYSTEM_CHANNEL_HINTS = Object.freeze({
  admin_report: "فقط برای ادمین‌ها؛ همیشه فعال و بدون قفل عضویت",
  purchase_report: "اطلاع خریدها و سفارش‌های موفق",
  notification: "اطلاع‌رسانی عمومی به کاربران",
});

export function isChannelLockSlot(slotKey) {
  return CHANNEL_LOCK_SLOTS.includes(slotKey);
}

export function isAlwaysOnSystemChannel(slotKey) {
  return slotKey === "admin_report";
}

export async function ensureAdminSystemChannelsTable() {
  const sql = getSql();
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS admin_system_channels (
      id          BIGSERIAL PRIMARY KEY,
      slot_key    TEXT NOT NULL UNIQUE,
      chat_id     BIGINT NOT NULL,
      username    TEXT NOT NULL,
      title       TEXT NOT NULL,
      is_active   BOOLEAN NOT NULL DEFAULT TRUE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT admin_system_channels_slot_check CHECK (
        slot_key IN ('admin_report', 'purchase_report', 'notification')
      )
    )
  `);
  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS admin_system_channels_chat_idx
      ON admin_system_channels (chat_id)
  `);
  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS admin_system_channels_active_idx
      ON admin_system_channels (is_active)
  `);
}

export class AdminSystemChannelError extends Error {
  constructor(message, code = "INVALID_LINK") {
    super(message);
    this.name = "AdminSystemChannelError";
    this.code = code;
    this.status =
      code === "NOT_FOUND"
        ? 404
        : code === "BOT_NOT_ADMIN" ||
            code === "USER_NOT_ADMIN" ||
            code === "CHANNEL_UNAVAILABLE"
          ? 409
          : 400;
  }
}

function assertSlot(slotKey) {
  if (!ADMIN_SYSTEM_CHANNEL_SLOTS.includes(slotKey)) {
    throw new AdminSystemChannelError("نوع کانال نامعتبر است", "INVALID_SLOT");
  }
  return slotKey;
}

function isAdminStatus(status) {
  return status === "administrator" || status === "creator";
}

function isMemberStatus(status) {
  return (
    status === "creator" ||
    status === "administrator" ||
    status === "member" ||
    status === "restricted"
  );
}

function serializeChannel(row) {
  const slotKey = row.slot_key;
  return {
    slotKey,
    label: ADMIN_SYSTEM_CHANNEL_LABELS[slotKey],
    hint: ADMIN_SYSTEM_CHANNEL_HINTS[slotKey],
    chatId: String(row.chat_id),
    username: row.username,
    title: row.title,
    isActive: Boolean(row.is_active),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export function parseTelegramPostLink(rawLink) {
  const trimmed = String(rawLink || "").trim();
  if (!trimmed) {
    throw new AdminSystemChannelError("لینک پست را وارد کنید", "INVALID_LINK");
  }

  let normalized = trimmed;
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized.replace(/^\/+/, "")}`;
  }

  let url;
  try {
    url = new URL(normalized);
  } catch {
    throw new AdminSystemChannelError("لینک پست معتبر نیست", "INVALID_LINK");
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (host !== "t.me" && host !== "telegram.me" && host !== "telegram.dog") {
    throw new AdminSystemChannelError(
      "فقط لینک پست تلگرام پذیرفته می‌شود",
      "INVALID_LINK",
    );
  }

  const parts = url.pathname
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts[0]?.toLowerCase() === "c") {
    throw new AdminSystemChannelError(
      "فقط پست کانال‌های عمومی پشتیبانی می‌شود",
      "PRIVATE_CHANNEL",
    );
  }

  const usernameIndex = parts[0]?.toLowerCase() === "s" ? 1 : 0;
  const username = parts[usernameIndex];
  const messageIdRaw = parts[usernameIndex + 1];

  if (!username || !/^[a-zA-Z][a-zA-Z0-9_]{3,31}$/.test(username)) {
    throw new AdminSystemChannelError("لینک پست معتبر نیست", "INVALID_LINK");
  }

  const messageId = Number.parseInt(messageIdRaw ?? "", 10);
  if (!Number.isFinite(messageId) || messageId <= 0) {
    throw new AdminSystemChannelError("لینک باید مربوط به یک پست باشد", "INVALID_LINK");
  }

  return {
    username,
    messageId,
    canonicalUrl: `https://t.me/${username}/${messageId}`,
  };
}

async function resolveBotIdentity() {
  const api = getBotApi();
  const me = await api.getMe();
  if (!me?.id || !me.username) {
    throw new AdminSystemChannelError("ربات در دسترس نیست", "CHANNEL_UNAVAILABLE");
  }
  return { id: me.id, username: me.username };
}

export async function getAdminSystemChannelsBotInfo() {
  const bot = await resolveBotIdentity();
  return {
    username: bot.username,
    deepLink: `https://t.me/${bot.username}?startchannel&admin=post_messages+edit_messages+delete_messages`,
  };
}

export async function listAdminSystemChannels() {
  const sql = getSql();
  const rows = await sql`SELECT * FROM admin_system_channels`;
  const bySlot = new Map(rows.map((row) => [row.slot_key, row]));

  return {
    items: ADMIN_SYSTEM_CHANNEL_SLOTS.map((slotKey) => {
      const row = bySlot.get(slotKey);
      return {
        slotKey,
        label: ADMIN_SYSTEM_CHANNEL_LABELS[slotKey],
        hint: ADMIN_SYSTEM_CHANNEL_HINTS[slotKey],
        channel: row ? serializeChannel(row) : null,
      };
    }),
  };
}

export async function registerAdminSystemChannel(actor, slotKeyRaw, link) {
  const slotKey = assertSlot(slotKeyRaw);
  const parsed = parseTelegramPostLink(link);
  const api = getBotApi();
  const bot = await resolveBotIdentity();
  const chatId = `@${parsed.username}`;

  let chat;
  try {
    chat = await api.getChat(chatId);
  } catch {
    throw new AdminSystemChannelError(
      "کانال پیدا نشد یا عمومی نیست",
      "CHANNEL_UNAVAILABLE",
    );
  }

  if (chat.type !== "channel") {
    throw new AdminSystemChannelError(
      "لینک باید مربوط به یک کانال باشد",
      "CHANNEL_UNAVAILABLE",
    );
  }

  let botMember;
  try {
    botMember = await api.getChatMember(chat.id, bot.id);
  } catch {
    throw new AdminSystemChannelError(
      "ربات را به‌عنوان ادمین کانال اضافه کنید و دوباره تلاش کنید",
      "BOT_NOT_ADMIN",
    );
  }

  if (!isAdminStatus(botMember.status)) {
    throw new AdminSystemChannelError("ربات باید ادمین کانال باشد", "BOT_NOT_ADMIN");
  }

  let userMember;
  try {
    userMember = await api.getChatMember(chat.id, Number(actor.telegramId));
  } catch {
    throw new AdminSystemChannelError("شما باید ادمین این کانال باشید", "USER_NOT_ADMIN");
  }

  if (!isAdminStatus(userMember.status)) {
    throw new AdminSystemChannelError(
      "فقط ادمین کانال می‌تواند آن را ثبت کند",
      "USER_NOT_ADMIN",
    );
  }

  const username = (chat.username ?? parsed.username).toLowerCase();
  const title = chat.title?.trim() || username;
  const sql = getSql();

  const [row] = await sql`
    INSERT INTO admin_system_channels (
      slot_key, chat_id, username, title, is_active, updated_at
    ) VALUES (
      ${slotKey}, ${chat.id}, ${username}, ${title}, TRUE, NOW()
    )
    ON CONFLICT (slot_key) DO UPDATE SET
      chat_id = EXCLUDED.chat_id,
      username = EXCLUDED.username,
      title = EXCLUDED.title,
      is_active = TRUE,
      updated_at = NOW()
    RETURNING *
  `;

  log.event("channels", `register ${slotKey} @${username} by:${actor.telegramId}`);
  return { channel: serializeChannel(row) };
}

export async function setAdminSystemChannelActive(slotKeyRaw, isActive) {
  const slotKey = assertSlot(slotKeyRaw);
  if (isAlwaysOnSystemChannel(slotKey)) {
    throw new AdminSystemChannelError(
      "کانال گزارش ادمین همیشه فعال است و قفل ندارد",
      "INVALID_SLOT",
    );
  }

  const sql = getSql();
  const [existing] = await sql`
    SELECT * FROM admin_system_channels WHERE slot_key = ${slotKey} LIMIT 1
  `;
  if (!existing) {
    throw new AdminSystemChannelError("کانالی برای این بخش ثبت نشده", "NOT_FOUND");
  }

  const [row] = await sql`
    UPDATE admin_system_channels
    SET is_active = ${Boolean(isActive)}, updated_at = NOW()
    WHERE slot_key = ${slotKey}
    RETURNING *
  `;

  return { channel: serializeChannel(row) };
}

export async function deactivateAdminSystemChannel(slotKeyRaw) {
  return setAdminSystemChannelActive(slotKeyRaw, false);
}

export async function deleteAdminSystemChannel(slotKeyRaw) {
  const slotKey = assertSlot(slotKeyRaw);
  const sql = getSql();
  const result = await sql`
    DELETE FROM admin_system_channels WHERE slot_key = ${slotKey} RETURNING id
  `;
  if (result.length === 0) {
    throw new AdminSystemChannelError("کانالی برای این بخش ثبت نشده", "NOT_FOUND");
  }
  return { ok: true };
}

export async function deactivateAdminSystemChannelsByChatId(chatId) {
  const sql = getSql();
  await sql`
    UPDATE admin_system_channels
    SET is_active = FALSE, updated_at = NOW()
    WHERE chat_id = ${chatId}
      AND is_active = TRUE
      AND slot_key <> 'admin_report'
  `;
}

async function checkUserJoinedChannel(chatId, telegramId) {
  try {
    const member = await getBotApi().getChatMember(Number(chatId), Number(telegramId));
    return isMemberStatus(member.status);
  } catch {
    return false;
  }
}

function serializeLockChannel(row, joined) {
  const slotKey = row.slot_key;
  const username = String(row.username).replace(/^@/, "").toLowerCase();
  return {
    slotKey,
    label: ADMIN_SYSTEM_CHANNEL_LABELS[slotKey] ?? row.title,
    title: row.title,
    username,
    url: `https://t.me/${username}`,
    joined,
  };
}

export async function listActiveSystemChannelsForLock() {
  const sql = getSql();
  const slots = [...CHANNEL_LOCK_SLOTS];
  const rows = await sql`
    SELECT * FROM admin_system_channels
    WHERE is_active = TRUE
      AND slot_key = ANY(${slots})
    ORDER BY created_at ASC
  `;
  const order = new Map(CHANNEL_LOCK_SLOTS.map((slot, index) => [slot, index]));
  return [...rows].sort(
    (a, b) => (order.get(a.slot_key) ?? 99) - (order.get(b.slot_key) ?? 99),
  );
}

export async function getChannelLockStatus(user) {
  if (isStaffRole(user.role)) {
    return { required: false, bypassed: true, channels: [] };
  }

  const rows = await listActiveSystemChannelsForLock();
  if (rows.length === 0) {
    return { required: false, bypassed: false, channels: [] };
  }

  const channels = await Promise.all(
    rows.map(async (row) => {
      const joined = await checkUserJoinedChannel(row.chat_id, user.telegramId);
      return serializeLockChannel(row, joined);
    }),
  );

  return {
    required: channels.some((channel) => !channel.joined),
    bypassed: false,
    channels,
  };
}

export async function checkChannelLockMembership(user, slotKeyRaw) {
  if (!isChannelLockSlot(slotKeyRaw)) return null;

  const sql = getSql();
  const [row] = await sql`
    SELECT * FROM admin_system_channels
    WHERE slot_key = ${slotKeyRaw} AND is_active = TRUE
    LIMIT 1
  `;
  if (!row) return null;

  const joined = await checkUserJoinedChannel(row.chat_id, user.telegramId);
  return serializeLockChannel(row, joined);
}
