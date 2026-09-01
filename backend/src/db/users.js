import { getSql } from "./postgres.js";

export const USER_ROLES = Object.freeze({
  USER: "User",
  ADMIN: "Admin",
  SUPERVISOR: "Supervisor",
});

const ROLE_TO_API = {
  [USER_ROLES.USER]: "user",
  [USER_ROLES.ADMIN]: "admin",
  [USER_ROLES.SUPERVISOR]: "supervisor",
};

const API_TO_ROLE = {
  user: USER_ROLES.USER,
  admin: USER_ROLES.ADMIN,
  supervisor: USER_ROLES.SUPERVISOR,
};

export async function ensureUsersTable() {
  const sql = getSql();

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS users (
      id                  BIGSERIAL PRIMARY KEY,
      user_full_name      TEXT NULL,
      user_telegram_name  TEXT NULL,
      user_id             BIGINT NOT NULL UNIQUE,
      user_name           TEXT NULL,
      balance             BIGINT NOT NULL DEFAULT 0,
      is_premium          BOOLEAN NOT NULL DEFAULT FALSE,
      user_email          TEXT NULL,
      user_phone          TEXT NULL,
      user_role           TEXT NOT NULL DEFAULT 'User',
      is_banned           BOOLEAN NOT NULL DEFAULT FALSE,
      date_created        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT users_role_check CHECK (
        user_role IN ('User', 'Admin', 'Supervisor')
      ),
      CONSTRAINT users_balance_nonnegative CHECK (balance >= 0)
    )
  `);

  await sql.unsafe(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS user_phone TEXT NULL
  `);

  await sql.unsafe(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS panel_admin_password TEXT NULL
  `);

  await sql.unsafe(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS has_claimed_trial BOOLEAN NOT NULL DEFAULT FALSE
  `);

  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS users_user_name_idx ON users (user_name)
  `);
}

/**
 * Upsert from Telegram /start or Mini App auth.
 * Does not overwrite user_full_name, user_email, user_phone, balance, user_role, or is_banned.
 */
export async function upsertUserFromTelegram(from) {
  if (!from?.id) {
    throw new Error("Telegram user id is required");
  }

  const sql = getSql();
  const telegramName =
    [from.first_name, from.last_name].filter(Boolean).join(" ").trim() || null;
  const userName = from.username ?? null;
  const isPremium = Boolean(from.is_premium);

  const [user] = await sql`
    INSERT INTO users (
      user_telegram_name,
      user_id,
      user_name,
      is_premium
    ) VALUES (
      ${telegramName},
      ${from.id},
      ${userName},
      ${isPremium}
    )
    ON CONFLICT (user_id) DO UPDATE SET
      user_telegram_name = EXCLUDED.user_telegram_name,
      user_name = EXCLUDED.user_name,
      is_premium = EXCLUDED.is_premium
    RETURNING *
  `;

  return user;
}

export async function findUserByTelegramId(telegramId) {
  const sql = getSql();
  const [row] = await sql`
    SELECT *
    FROM users
    WHERE user_id = ${telegramId}
    LIMIT 1
  `;
  return row ?? null;
}

export async function listUsersAdmin({ query = "", limit = 50 } = {}) {
  const sql = getSql();
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const q = typeof query === "string" ? query.trim() : "";

  if (!q) {
    const rows = await sql`
      SELECT *
      FROM users
      ORDER BY date_created DESC
      LIMIT ${safeLimit}
    `;
    return rows.map(toPublicUser);
  }

  const like = `%${q.replace(/[%_]/g, "")}%`;
  const asId = /^\d+$/.test(q) ? Number(q) : null;

  const rows =
    asId != null && Number.isSafeInteger(asId)
      ? await sql`
          SELECT *
          FROM users
          WHERE
            user_id = ${asId}
            OR id = ${asId}
            OR user_name ILIKE ${like}
            OR user_telegram_name ILIKE ${like}
            OR user_full_name ILIKE ${like}
            OR user_email ILIKE ${like}
          ORDER BY date_created DESC
          LIMIT ${safeLimit}
        `
      : await sql`
          SELECT *
          FROM users
          WHERE
            user_name ILIKE ${like}
            OR user_telegram_name ILIKE ${like}
            OR user_full_name ILIKE ${like}
            OR user_email ILIKE ${like}
          ORDER BY date_created DESC
          LIMIT ${safeLimit}
        `;

  return rows.map(toPublicUser);
}

export async function countUsers() {
  const sql = getSql();
  const [row] = await sql`SELECT COUNT(*)::int AS count FROM users`;
  return Number(row?.count ?? 0);
}

export async function findUserByEmail(email, { excludeTelegramId } = {}) {
  const sql = getSql();
  const normalized = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!normalized) return null;

  if (excludeTelegramId != null) {
    const [row] = await sql`
      SELECT *
      FROM users
      WHERE lower(user_email) = ${normalized}
        AND user_id <> ${excludeTelegramId}
      LIMIT 1
    `;
    return row ?? null;
  }

  const [row] = await sql`
    SELECT *
    FROM users
    WHERE lower(user_email) = ${normalized}
    LIMIT 1
  `;
  return row ?? null;
}

export async function updateUserProfile(telegramId, { realName, email } = {}) {
  const sql = getSql();
  const patch = {};
  const columns = [];

  if (realName !== undefined) {
    const value = typeof realName === "string" ? realName.trim() : "";
    if (!value) {
      throw Object.assign(new Error("نام کامل نمی‌تواند خالی باشد"), { status: 400 });
    }
    if (value.length > 80) {
      throw Object.assign(new Error("نام کامل بیش از حد طولانی است"), { status: 400 });
    }
    patch.user_full_name = value;
    columns.push("user_full_name");
  }

  if (email !== undefined) {
    const value = typeof email === "string" ? email.trim() : "";
    if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      throw Object.assign(new Error("ایمیل معتبر نیست"), { status: 400 });
    }
    if (value.length > 120) {
      throw Object.assign(new Error("ایمیل بیش از حد طولانی است"), { status: 400 });
    }

    const taken = await findUserByEmail(value, { excludeTelegramId: telegramId });
    if (taken) {
      throw Object.assign(new Error("این ایمیل قبلاً ثبت شده است"), { status: 409 });
    }

    patch.user_email = value;
    columns.push("user_email");
  }

  if (columns.length === 0) {
    throw Object.assign(new Error("هیچ فیلدی برای به‌روزرسانی ارسال نشده"), {
      status: 400,
    });
  }

  const [row] = await sql`
    UPDATE users
    SET ${sql(patch, columns)}
    WHERE user_id = ${telegramId}
    RETURNING *
  `;

  if (!row) {
    throw Object.assign(new Error("کاربر یافت نشد"), { status: 404 });
  }

  return row;
}

export async function getUserByTelegramId(telegramId) {
  const row = await findUserByTelegramId(telegramId);
  if (!row) return null;
  return {
    id: Number(row.id),
    user_id: Number(row.user_id),
    balance: Number(row.balance ?? 0),
    panelAdminPassword: row.panel_admin_password ?? null,
  };
}

export async function saveUserPanelAdminPassword(telegramId, password) {
  const sql = getSql();
  await sql`
    UPDATE users
    SET panel_admin_password = ${password}
    WHERE user_id = ${telegramId}
  `;
}

export async function setHasClaimedTrial(telegramId, hasClaimed = true) {
  const sql = getSql();
  await sql`
    UPDATE users
    SET has_claimed_trial = ${hasClaimed}
    WHERE user_id = ${telegramId}
  `;
}

export async function setUserBanned(telegramId, isBanned) {
  const sql = getSql();
  const [row] = await sql`
    UPDATE users
    SET is_banned = ${Boolean(isBanned)}
    WHERE user_id = ${telegramId}
    RETURNING *
  `;

  if (!row) {
    throw Object.assign(new Error("کاربر یافت نشد"), { status: 404 });
  }

  return toPublicUser(row);
}

export async function setUserBalance(telegramId, balanceToman) {
  const balance = Math.trunc(Number(balanceToman));
  if (!Number.isFinite(balance) || balance < 0) {
    throw Object.assign(new Error("موجودی نامعتبر است"), { status: 400 });
  }

  const sql = getSql();
  const [before] = await sql`
    SELECT balance
    FROM users
    WHERE user_id = ${telegramId}
    LIMIT 1
  `;

  if (!before) {
    throw Object.assign(new Error("کاربر یافت نشد"), { status: 404 });
  }

  const previousBalance = Number(before.balance ?? 0);
  const [row] = await sql`
    UPDATE users
    SET balance = ${balance}
    WHERE user_id = ${telegramId}
    RETURNING *
  `;

  return {
    user: toPublicUser(row),
    previousBalance,
    newBalance: balance,
  };
}

export async function setUserRole(telegramId, roleApi) {
  const normalized = String(roleApi || "").trim().toLowerCase();
  const dbRole = API_TO_ROLE[normalized];
  if (!dbRole) {
    throw Object.assign(new Error("نقش نامعتبر است"), { status: 400 });
  }

  const sql = getSql();
  const [row] = await sql`
    UPDATE users
    SET user_role = ${dbRole}
    WHERE user_id = ${telegramId}
    RETURNING *
  `;

  if (!row) {
    throw Object.assign(new Error("کاربر یافت نشد"), { status: 404 });
  }

  return toPublicUser(row);
}

export function toPublicUser(row) {
  const role = ROLE_TO_API[row.user_role] || "user";

  return {
    id: Number(row.id),
    telegramId: Number(row.user_id),
    realName: row.user_full_name ?? null,
    telegramName: row.user_telegram_name ?? null,
    username: row.user_name ?? null,
    balance: Number(row.balance ?? 0),
    isPremium: Boolean(row.is_premium),
    email: row.user_email ?? null,
    phoneNumber: row.user_phone ?? null,
    role,
    isBanned: Boolean(row.is_banned),
    createdAt: row.date_created
      ? new Date(row.date_created).toISOString()
      : null,
    canAccessAdminPanel: isStaffRole(role),
    isSupervisor: isSupervisorRole(role),
  };
}

/** Role rank: Supervisor > Admin > User */
export const ROLE_RANK = Object.freeze({
  user: 0,
  admin: 1,
  supervisor: 2,
});

export function roleRank(role) {
  return ROLE_RANK[role] ?? 0;
}

/** Admin panel staff (Admin or Supervisor). */
export function isStaffRole(role) {
  return roleRank(role) >= ROLE_RANK.admin;
}

export function isSupervisorRole(role) {
  return roleRank(role) >= ROLE_RANK.supervisor;
}
