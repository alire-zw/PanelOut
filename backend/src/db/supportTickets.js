import { createHash } from "node:crypto";
import { getSql } from "./postgres.js";
import { redis } from "./redis.js";
import { log } from "../lib/logger.js";

export const SUPPORT_CATEGORIES = Object.freeze([
  "sales",
  "product",
  "wallet",
  "other",
]);

export const SUPPORT_CATEGORY_LABELS = Object.freeze({
  sales: "واحد فروش",
  product: "پشتیبانی محصول",
  wallet: "کیف پول و پرداخت",
  other: "سایر",
  // legacy label if old rows remain
  kyc: "سایر",
});

const LIST_TTL = 7 * 24 * 60 * 60;
const IMAGE_RE = /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/;

function listKey(userId) {
  return `support:tickets:v1:${userId}`;
}

function detailKey(userId, ticketCode) {
  return `support:ticket:v1:${userId}:${ticketCode}`;
}

export function ticketCodeFromId(id) {
  return `T${10_000 + Number(id)}`;
}

export function subjectFromCategory(category) {
  return SUPPORT_CATEGORY_LABELS[category] || SUPPORT_CATEGORY_LABELS.other;
}

export function assertSupportCategory(category) {
  if (!SUPPORT_CATEGORIES.includes(category)) {
    throw Object.assign(new Error("دسته‌بندی نامعتبر است"), { status: 400 });
  }
  return category;
}

export function assertImageData(imageData) {
  if (imageData == null || imageData === "") return null;
  if (typeof imageData !== "string" || imageData.length > 900_000 || !IMAGE_RE.test(imageData)) {
    throw Object.assign(new Error("تصویر نامعتبر است"), { status: 400 });
  }
  return imageData;
}

export async function ensureSupportTicketsTables() {
  const sql = getSql();

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS support_tickets (
      id            BIGSERIAL PRIMARY KEY,
      ticket_code   TEXT NOT NULL UNIQUE,
      user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category      TEXT NOT NULL,
      order_id      TEXT NULL,
      subject       TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'open',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT support_tickets_category_check CHECK (
        category IN ('sales', 'product', 'wallet', 'other')
      ),
      CONSTRAINT support_tickets_status_check CHECK (
        status IN ('open', 'answered', 'closed')
      )
    )
  `);

  // Drop legacy KYC category if present
  await sql.unsafe(`
    UPDATE support_tickets SET category = 'other', subject = 'سایر'
    WHERE category = 'kyc'
  `);
  await sql.unsafe(`
    ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_category_check
  `);
  await sql.unsafe(`
    ALTER TABLE support_tickets
    ADD CONSTRAINT support_tickets_category_check
    CHECK (category IN ('sales', 'product', 'wallet', 'other'))
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS support_ticket_messages (
      id            BIGSERIAL PRIMARY KEY,
      ticket_id     BIGINT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
      sender_role   TEXT NOT NULL,
      body          TEXT NOT NULL DEFAULT '',
      image_data    TEXT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT support_ticket_messages_role_check CHECK (
        sender_role IN ('user', 'admin')
      )
    )
  `);

  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS support_tickets_user_updated_idx
      ON support_tickets (user_id, updated_at DESC)
  `);
  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS support_tickets_status_updated_idx
      ON support_tickets (status, updated_at DESC)
  `);
  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS support_ticket_messages_ticket_idx
      ON support_ticket_messages (ticket_id, created_at ASC)
  `);
}

function serializeMessage(row) {
  return {
    id: Number(row.id),
    senderRole: row.sender_role,
    body: row.body || "",
    imageData: row.image_data ?? null,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function serializeSummary(ticket, lastMessage) {
  return {
    id: Number(ticket.id),
    ticketCode: ticket.ticket_code,
    category: ticket.category,
    categoryLabel: SUPPORT_CATEGORY_LABELS[ticket.category] || ticket.category,
    orderId: ticket.order_id ?? null,
    subject: ticket.subject,
    status: ticket.status,
    createdAt: new Date(ticket.created_at).toISOString(),
    updatedAt: new Date(ticket.updated_at).toISOString(),
    lastMessage: lastMessage
      ? {
          senderRole: lastMessage.sender_role,
          body: lastMessage.body || "",
          createdAt: new Date(lastMessage.created_at).toISOString(),
        }
      : null,
  };
}

function mapUser(row) {
  return {
    id: Number(row.user_pk),
    telegramId: String(row.telegram_id),
    username: row.user_name ?? null,
    firstName: row.user_telegram_name ?? null,
    lastName: null,
    realName: row.user_full_name ?? null,
  };
}

export async function buildTicketsVersion(userId) {
  const sql = getSql();
  const [ticketAgg] = await sql`
    SELECT
      COUNT(*)::int AS count,
      COALESCE(MAX(id), 0)::bigint AS max_id,
      MAX(updated_at) AS max_updated
    FROM support_tickets
    WHERE user_id = ${userId}
  `;
  const [messageAgg] = await sql`
    SELECT
      COUNT(m.id)::int AS count,
      COALESCE(MAX(m.id), 0)::bigint AS max_id
    FROM support_ticket_messages m
    INNER JOIN support_tickets t ON t.id = m.ticket_id
    WHERE t.user_id = ${userId}
  `;

  const fingerprint = [
    ticketAgg?.count ?? 0,
    ticketAgg?.max_id ?? 0,
    ticketAgg?.max_updated ? new Date(ticketAgg.max_updated).toISOString() : "",
    messageAgg?.count ?? 0,
    messageAgg?.max_id ?? 0,
  ].join("|");

  return createHash("sha256").update(fingerprint).digest("hex").slice(0, 16);
}

export async function buildTicketDetailVersion(ticketId) {
  const sql = getSql();
  const [ticket] = await sql`
    SELECT updated_at, status FROM support_tickets WHERE id = ${ticketId} LIMIT 1
  `;
  const [messageAgg] = await sql`
    SELECT COUNT(*)::int AS count, COALESCE(MAX(id), 0)::bigint AS max_id
    FROM support_ticket_messages
    WHERE ticket_id = ${ticketId}
  `;

  const fingerprint = [
    ticket?.updated_at ? new Date(ticket.updated_at).toISOString() : "",
    ticket?.status ?? "",
    messageAgg?.count ?? 0,
    messageAgg?.max_id ?? 0,
  ].join("|");

  return createHash("sha256").update(fingerprint).digest("hex").slice(0, 16);
}

async function listTicketsForUser(userId) {
  const sql = getSql();
  const tickets = await sql`
    SELECT *
    FROM support_tickets
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC
  `;

  if (tickets.length === 0) return [];

  const ids = tickets.map((t) => Number(t.id));
  const lasts = await sql`
    SELECT DISTINCT ON (ticket_id)
      ticket_id, sender_role, body, created_at
    FROM support_ticket_messages
    WHERE ticket_id = ANY(${ids})
    ORDER BY ticket_id, created_at DESC
  `;
  const lastByTicket = new Map(lasts.map((row) => [Number(row.ticket_id), row]));

  return tickets.map((ticket) =>
    serializeSummary(ticket, lastByTicket.get(Number(ticket.id)) ?? null),
  );
}

export async function invalidateUserSupportCaches(userId, ticketCode) {
  const multi = redis.multi();
  multi.del(listKey(userId));
  if (ticketCode) multi.del(detailKey(userId, ticketCode));
  await multi.exec();
}

async function refreshListCache(userId) {
  const [items, version] = await Promise.all([
    listTicketsForUser(userId),
    buildTicketsVersion(userId),
  ]);
  const payload = {
    version,
    cachedAt: new Date().toISOString(),
    items,
  };
  await redis.set(listKey(userId), JSON.stringify(payload), "EX", LIST_TTL);
  return payload;
}

export async function getSupportTicketsCached(userId) {
  const raw = await redis.get(listKey(userId));
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.version && Array.isArray(parsed.items)) return parsed;
    } catch {
      await redis.del(listKey(userId));
    }
  }
  return refreshListCache(userId);
}

export async function syncSupportTickets(userId, clientVersion) {
  const currentVersion = await buildTicketsVersion(userId);
  const raw = await redis.get(listKey(userId));
  let cached = null;
  if (raw) {
    try {
      cached = JSON.parse(raw);
    } catch {
      cached = null;
    }
  }

  const isUpToDate =
    cached &&
    cached.version === currentVersion &&
    (!clientVersion || clientVersion === currentVersion);

  if (isUpToDate) {
    return {
      changed: false,
      version: cached.version,
      cachedAt: cached.cachedAt,
      items: cached.items,
    };
  }

  const fresh = await refreshListCache(userId);
  return {
    changed: !clientVersion || clientVersion !== fresh.version,
    version: fresh.version,
    cachedAt: fresh.cachedAt,
    items: fresh.items,
  };
}

async function findOwnedTicketRow(userId, idOrCode) {
  const sql = getSql();
  const asId = /^\d+$/.test(String(idOrCode)) ? Number(idOrCode) : null;

  if (asId != null && Number.isSafeInteger(asId)) {
    const [byId] = await sql`
      SELECT * FROM support_tickets
      WHERE user_id = ${userId} AND (ticket_code = ${idOrCode} OR id = ${asId})
      LIMIT 1
    `;
    return byId ?? null;
  }

  const [byCode] = await sql`
    SELECT * FROM support_tickets
    WHERE user_id = ${userId} AND ticket_code = ${idOrCode}
    LIMIT 1
  `;
  return byCode ?? null;
}

async function loadTicketDetail(ticket) {
  const sql = getSql();
  const messages = await sql`
    SELECT * FROM support_ticket_messages
    WHERE ticket_id = ${ticket.id}
    ORDER BY created_at ASC
  `;

  return {
    ...serializeSummary(ticket, messages[messages.length - 1] ?? null),
    order: null,
    messages: messages.map(serializeMessage),
  };
}

async function writeDetailCache(userId, ticketCode, ticketId, ticket) {
  const version = await buildTicketDetailVersion(ticketId);
  const payload = {
    version,
    cachedAt: new Date().toISOString(),
    ticket,
  };
  await redis.set(detailKey(userId, ticketCode), JSON.stringify(payload), "EX", LIST_TTL);
  return payload;
}

export async function getUserTicket(userId, idOrCode) {
  const raw = await redis.get(detailKey(userId, idOrCode));
  if (raw) {
    try {
      const cached = JSON.parse(raw);
      if (cached?.version && cached.ticket) {
        return {
          ticket: cached.ticket,
          version: cached.version,
          cachedAt: cached.cachedAt,
        };
      }
    } catch {
      /* rebuild */
    }
  }

  const row = await findOwnedTicketRow(userId, idOrCode);
  if (!row) {
    throw Object.assign(new Error("تیکت پیدا نشد"), { status: 404 });
  }

  if (row.ticket_code !== idOrCode) {
    const byCodeRaw = await redis.get(detailKey(userId, row.ticket_code));
    if (byCodeRaw) {
      try {
        const cached = JSON.parse(byCodeRaw);
        if (cached?.version && cached.ticket) {
          return {
            ticket: cached.ticket,
            version: cached.version,
            cachedAt: cached.cachedAt,
          };
        }
      } catch {
        /* rebuild */
      }
    }
  }

  const serialized = await loadTicketDetail(row);
  const stored = await writeDetailCache(
    userId,
    row.ticket_code,
    Number(row.id),
    serialized,
  );

  return {
    ticket: stored.ticket,
    version: stored.version,
    cachedAt: stored.cachedAt,
  };
}

export async function syncUserTicket(userId, idOrCode, clientVersion) {
  const meta = await findOwnedTicketRow(userId, idOrCode);
  if (!meta) {
    throw Object.assign(new Error("تیکت پیدا نشد"), { status: 404 });
  }

  const version = await buildTicketDetailVersion(Number(meta.id));
  const raw = await redis.get(detailKey(userId, meta.ticket_code));
  let cached = null;
  if (raw) {
    try {
      cached = JSON.parse(raw);
    } catch {
      cached = null;
    }
  }

  const isUpToDate =
    cached &&
    cached.version === version &&
    (!clientVersion || clientVersion === version);

  if (isUpToDate) {
    return {
      changed: false,
      version: cached.version,
      cachedAt: cached.cachedAt,
      ticket: cached.ticket,
    };
  }

  const serialized = await loadTicketDetail(meta);
  const stored = await writeDetailCache(
    userId,
    meta.ticket_code,
    Number(meta.id),
    serialized,
  );

  return {
    changed: !clientVersion || clientVersion !== stored.version,
    version: stored.version,
    cachedAt: stored.cachedAt,
    ticket: stored.ticket,
  };
}

export async function createUserTicket(userId, input) {
  const sql = getSql();
  const category = assertSupportCategory(input.category);
  const imageData = assertImageData(input.imageData);
  const bodyText =
    typeof input.body === "string" ? input.body.trim().slice(0, 4000) : "";
  if (!bodyText && !imageData) {
    throw Object.assign(new Error("متن یا تصویر الزامی است"), { status: 400 });
  }

  const orderId =
    typeof input.orderId === "string" && input.orderId.trim()
      ? input.orderId.trim().slice(0, 64)
      : null;
  const subject = subjectFromCategory(category);
  const messageBody = bodyText || (imageData ? "📷 تصویر" : "");
  const tempCode = `TMP-${Date.now()}`;

  const ticket = await sql.begin(async (tx) => {
    const [created] = await tx`
      INSERT INTO support_tickets (
        ticket_code, user_id, category, order_id, subject, status
      ) VALUES (
        ${tempCode}, ${userId}, ${category}, ${orderId}, ${subject}, 'open'
      )
      RETURNING *
    `;
    const code = ticketCodeFromId(created.id);
    const [updated] = await tx`
      UPDATE support_tickets
      SET ticket_code = ${code}
      WHERE id = ${created.id}
      RETURNING *
    `;
    await tx`
      INSERT INTO support_ticket_messages (
        ticket_id, sender_role, body, image_data
      ) VALUES (
        ${updated.id}, 'user', ${messageBody}, ${imageData}
      )
    `;
    return updated;
  });

  await invalidateUserSupportCaches(userId, ticket.ticket_code);
  log.event("support", `ticket create ${ticket.ticket_code} user:${userId}`);
  return getUserTicket(userId, ticket.ticket_code);
}

export async function replyUserTicket(userId, idOrCode, input) {
  const sql = getSql();
  const imageData = assertImageData(input.imageData);
  const bodyText =
    typeof input.body === "string" ? input.body.trim().slice(0, 4000) : "";
  if (!bodyText && !imageData) {
    throw Object.assign(new Error("متن یا تصویر الزامی است"), { status: 400 });
  }

  const ticket = await findOwnedTicketRow(userId, idOrCode);
  if (!ticket) {
    throw Object.assign(new Error("تیکت پیدا نشد"), { status: 404 });
  }
  if (ticket.status === "closed") {
    throw Object.assign(new Error("این تیکت بسته شده است"), { status: 409 });
  }

  const messageBody = bodyText || (imageData ? "📷 تصویر" : "");
  const nextStatus = ticket.status === "answered" ? "open" : ticket.status;

  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO support_ticket_messages (
        ticket_id, sender_role, body, image_data
      ) VALUES (
        ${ticket.id}, 'user', ${messageBody}, ${imageData}
      )
    `;
    await tx`
      UPDATE support_tickets
      SET status = ${nextStatus}, updated_at = NOW()
      WHERE id = ${ticket.id}
    `;
  });

  await invalidateUserSupportCaches(userId, ticket.ticket_code);
  return getUserTicket(userId, ticket.ticket_code);
}

export async function countOpenSupportTickets() {
  const sql = getSql();
  const [row] = await sql`
    SELECT COUNT(*)::int AS count FROM support_tickets WHERE status = 'open'
  `;
  return Number(row?.count ?? 0);
}

export async function listAdminSupportTickets({
  page = 1,
  limit = 20,
  status,
  category,
  search,
} = {}) {
  const sql = getSql();
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const offset = (safePage - 1) * safeLimit;
  const statusFilter =
    status && ["open", "answered", "closed"].includes(status) ? status : null;
  const categoryFilter =
    category && SUPPORT_CATEGORIES.includes(category) ? category : null;
  const q = typeof search === "string" ? search.trim() : "";
  const like = q ? `%${q.replace(/[%_]/g, "")}%` : null;

  const [countRow] = await sql`
    SELECT COUNT(*)::int AS count
    FROM support_tickets t
    INNER JOIN users u ON u.id = t.user_id
    WHERE
      (${statusFilter}::text IS NULL OR t.status = ${statusFilter})
      AND (${categoryFilter}::text IS NULL OR t.category = ${categoryFilter})
      AND (
        ${like}::text IS NULL
        OR t.ticket_code ILIKE ${like}
        OR t.subject ILIKE ${like}
        OR COALESCE(t.order_id, '') ILIKE ${like}
        OR COALESCE(u.user_name, '') ILIKE ${like}
      )
  `;

  const total = Number(countRow?.count ?? 0);
  const rows = await sql`
    SELECT
      t.*,
      u.id AS user_pk,
      u.user_id AS telegram_id,
      u.user_name,
      u.user_telegram_name,
      u.user_full_name
    FROM support_tickets t
    INNER JOIN users u ON u.id = t.user_id
    WHERE
      (${statusFilter}::text IS NULL OR t.status = ${statusFilter})
      AND (${categoryFilter}::text IS NULL OR t.category = ${categoryFilter})
      AND (
        ${like}::text IS NULL
        OR t.ticket_code ILIKE ${like}
        OR t.subject ILIKE ${like}
        OR COALESCE(t.order_id, '') ILIKE ${like}
        OR COALESCE(u.user_name, '') ILIKE ${like}
      )
    ORDER BY t.updated_at DESC
    LIMIT ${safeLimit}
    OFFSET ${offset}
  `;

  const ids = rows.map((r) => Number(r.id));
  let lastByTicket = new Map();
  if (ids.length > 0) {
    const lasts = await sql`
      SELECT DISTINCT ON (ticket_id)
        ticket_id, sender_role, body, created_at
      FROM support_ticket_messages
      WHERE ticket_id = ANY(${ids})
      ORDER BY ticket_id, created_at DESC
    `;
    lastByTicket = new Map(lasts.map((row) => [Number(row.ticket_id), row]));
  }

  return {
    total,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    items: rows.map((row) => {
      const last = lastByTicket.get(Number(row.id)) ?? null;
      return {
        ...serializeSummary(row, last),
        user: mapUser(row),
      };
    }),
  };
}

export async function getAdminSupportTicket(id) {
  const sql = getSql();
  const [row] = await sql`
    SELECT
      t.*,
      u.id AS user_pk,
      u.user_id AS telegram_id,
      u.user_name,
      u.user_telegram_name,
      u.user_full_name
    FROM support_tickets t
    INNER JOIN users u ON u.id = t.user_id
    WHERE t.id = ${id}
    LIMIT 1
  `;
  if (!row) return null;

  const messages = await sql`
    SELECT * FROM support_ticket_messages
    WHERE ticket_id = ${id}
    ORDER BY created_at ASC
  `;

  return {
    ticket: {
      ...serializeSummary(row, messages[messages.length - 1] ?? null),
      user: mapUser(row),
      order: null,
      messages: messages.map(serializeMessage),
    },
  };
}

export async function replyAdminSupportTicket(id, { body, status } = {}) {
  const sql = getSql();
  const text = typeof body === "string" ? body.trim().slice(0, 4000) : "";
  if (!text) {
    throw Object.assign(new Error("متن پاسخ الزامی است"), { status: 400 });
  }
  const nextStatus =
    status && ["open", "answered", "closed"].includes(status)
      ? status
      : "answered";

  const [ticket] = await sql`
    SELECT * FROM support_tickets WHERE id = ${id} LIMIT 1
  `;
  if (!ticket) {
    throw Object.assign(new Error("تیکت پیدا نشد"), { status: 404 });
  }

  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO support_ticket_messages (ticket_id, sender_role, body)
      VALUES (${id}, 'admin', ${text})
    `;
    await tx`
      UPDATE support_tickets
      SET status = ${nextStatus}, updated_at = NOW()
      WHERE id = ${id}
    `;
  });

  await invalidateUserSupportCaches(Number(ticket.user_id), ticket.ticket_code);
  log.event("support", `admin reply ${ticket.ticket_code} status:${nextStatus}`);
  return getAdminSupportTicket(id);
}

const SUPPORT_TELEGRAM_KEY = "site:settings:support_telegram";

export function normalizeSupportTelegram(raw) {
  const cleaned = String(raw || "")
    .trim()
    .replace(/^@+/, "")
    .replace(/^https?:\/\/(t\.me|telegram\.me)\//i, "")
    .replace(/\/.*$/, "")
    .trim();

  if (!cleaned) return null;
  if (!/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(cleaned)) return null;
  return cleaned;
}

export async function getSupportTelegramUsername() {
  const raw = await redis.get(SUPPORT_TELEGRAM_KEY);
  if (!raw) return null;
  return normalizeSupportTelegram(raw);
}

export async function setSupportTelegramUsername(raw) {
  const normalized = normalizeSupportTelegram(raw);
  if (!normalized) {
    await redis.del(SUPPORT_TELEGRAM_KEY);
    return null;
  }
  await redis.set(SUPPORT_TELEGRAM_KEY, normalized);
  return normalized;
}
