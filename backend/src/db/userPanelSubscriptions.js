import { getSql } from "./postgres.js";

export const PanelServiceType = Object.freeze({
  TRIAL: "panel_trial",
  USAGE: "panel_usage",
  RESELLER: "panel_reseller",
});

export const OutboundServiceType = Object.freeze({
  VOLUME: "outbound_volume",
  USAGE: "outbound_usage",
});

export async function ensureUserPanelSubscriptionsTable() {
  const sql = getSql();
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS user_panel_subscriptions (
      id                BIGSERIAL PRIMARY KEY,
      user_row_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      panel_id          BIGINT NOT NULL REFERENCES pasarguard_panels(id),
      service_type      TEXT NOT NULL,
      client_username   TEXT NOT NULL,
      panel_admin_id    BIGINT NULL,
      panel_url         TEXT NOT NULL,
      status            TEXT NOT NULL DEFAULT 'active',
      payment_method    TEXT NULL,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT user_panel_subscriptions_type_check CHECK (
        service_type IN ('panel_trial', 'panel_usage', 'panel_unlimited', 'panel_reseller')
      ),
      CONSTRAINT user_panel_subscriptions_status_check CHECK (
        status IN ('active', 'suspended', 'deactivated')
      )
    )
  `);

  await sql.unsafe(`
    ALTER TABLE user_panel_subscriptions
    ADD COLUMN IF NOT EXISTS admin_password TEXT NULL
  `);

  await sql.unsafe(`
    ALTER TABLE user_panel_subscriptions
    ADD COLUMN IF NOT EXISTS wallet_balance BIGINT NOT NULL DEFAULT 0
  `);

  await sql.unsafe(`
    ALTER TABLE user_panel_subscriptions
    ADD COLUMN IF NOT EXISTS last_billed_traffic_bytes BIGINT NOT NULL DEFAULT 0
  `);

  await sql.unsafe(`
    ALTER TABLE user_panel_subscriptions
    ADD COLUMN IF NOT EXISTS prepaid_traffic_bytes BIGINT NOT NULL DEFAULT 0
  `);

  await sql.unsafe(`
    ALTER TABLE user_panel_subscriptions
    ADD COLUMN IF NOT EXISTS last_billed_at TIMESTAMPTZ NULL
  `);

  await sql.unsafe(`
    ALTER TABLE user_panel_subscriptions
    ADD COLUMN IF NOT EXISTS low_balance_notified BOOLEAN NOT NULL DEFAULT FALSE
  `);

  await sql.unsafe(`
    ALTER TABLE user_panel_subscriptions
    ADD COLUMN IF NOT EXISTS low_balance_5gb_notified BOOLEAN NOT NULL DEFAULT FALSE
  `);

  await sql.unsafe(`
    ALTER TABLE user_panel_subscriptions
    ADD COLUMN IF NOT EXISTS balance_warn_tier SMALLINT NOT NULL DEFAULT 0
  `);

  await sql.unsafe(`
    ALTER TABLE user_panel_subscriptions
    ADD COLUMN IF NOT EXISTS exhausted_notified BOOLEAN NOT NULL DEFAULT FALSE
  `);

  await sql.unsafe(`
    ALTER TABLE user_panel_subscriptions
    ADD COLUMN IF NOT EXISTS suspended_notified BOOLEAN NOT NULL DEFAULT FALSE
  `);

  await sql.unsafe(`
    ALTER TABLE user_panel_subscriptions
    ADD COLUMN IF NOT EXISTS connection_link TEXT NULL
  `);

  await sql.unsafe(`
    ALTER TABLE user_panel_subscriptions
    ADD COLUMN IF NOT EXISTS volume_gb INT NOT NULL DEFAULT 0
  `);

  await sql.unsafe(`
    ALTER TABLE user_panel_subscriptions
    ADD COLUMN IF NOT EXISTS purchase_amount_irt BIGINT NULL
  `);

  await sql.unsafe(`
    ALTER TABLE user_panel_subscriptions
    ADD COLUMN IF NOT EXISTS volume_remaining_15gb_notified BOOLEAN NOT NULL DEFAULT FALSE
  `);

  await sql.unsafe(`
    ALTER TABLE user_panel_subscriptions
    ADD COLUMN IF NOT EXISTS volume_remaining_10gb_notified BOOLEAN NOT NULL DEFAULT FALSE
  `);

  await sql.unsafe(`
    ALTER TABLE user_panel_subscriptions
    ADD COLUMN IF NOT EXISTS volume_remaining_5gb_notified BOOLEAN NOT NULL DEFAULT FALSE
  `);

  // Allow panel_reseller in existing DBs (recreate check constraint)
  await sql.unsafe(`
    ALTER TABLE user_panel_subscriptions
    DROP CONSTRAINT IF EXISTS user_panel_subscriptions_type_check
  `);
  await sql.unsafe(`
    ALTER TABLE user_panel_subscriptions
    ADD CONSTRAINT user_panel_subscriptions_type_check CHECK (
      service_type IN (
        'panel_trial', 'panel_usage', 'panel_unlimited', 'panel_reseller',
        'outbound_volume', 'outbound_usage'
      )
    )
  `);

  // Replace one-per-type unique with partial uniques so reseller can have many
  await sql.unsafe(`
    DROP INDEX IF EXISTS user_panel_subscriptions_user_type_uidx
  `);
  await sql.unsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS user_panel_subscriptions_user_trial_uidx
    ON user_panel_subscriptions (user_row_id)
    WHERE service_type = 'panel_trial'
  `);
  await sql.unsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS user_panel_subscriptions_user_usage_uidx
    ON user_panel_subscriptions (user_row_id)
    WHERE service_type = 'panel_usage'
  `);

  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS user_panel_subscriptions_user_idx
    ON user_panel_subscriptions (user_row_id)
  `);

  try {
    await sql.unsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS user_panel_subscriptions_username_lower_uidx
      ON user_panel_subscriptions (LOWER(client_username))
    `);
  } catch {
    // Duplicate usernames in existing data would block this index.
  }
}

function rowToSubscription(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    userRowId: row.user_row_id != null ? String(row.user_row_id) : null,
    panelId: String(row.panel_id),
    serviceType: row.service_type,
    clientUsername: row.client_username,
    adminPassword: row.admin_password || null,
    panelAdminId: row.panel_admin_id != null ? String(row.panel_admin_id) : null,
    panelUrl: row.panel_url,
    status: row.status,
    paymentMethod: row.payment_method,
    walletBalance: Number(row.wallet_balance ?? 0),
    lastBilledTrafficBytes: String(row.last_billed_traffic_bytes ?? 0),
    prepaidTrafficBytes: String(row.prepaid_traffic_bytes ?? 0),
    lastBilledAt: row.last_billed_at
      ? new Date(row.last_billed_at).toISOString()
      : null,
    lowBalanceNotified: Boolean(row.low_balance_notified),
    lowBalance5GbNotified: Boolean(row.low_balance_5gb_notified),
    balanceWarnTier: Number(row.balance_warn_tier ?? 0),
    exhaustedNotified: Boolean(row.exhausted_notified),
    suspendedNotified: Boolean(row.suspended_notified),
    connectionLink: row.connection_link || null,
    volumeGb: Number(row.volume_gb ?? 0),
    purchaseAmountIrt:
      row.purchase_amount_irt != null ? Number(row.purchase_amount_irt) : null,
    volumeRemaining15GbNotified: Boolean(row.volume_remaining_15gb_notified),
    volumeRemaining10GbNotified: Boolean(row.volume_remaining_10gb_notified),
    volumeRemaining5GbNotified: Boolean(row.volume_remaining_5gb_notified),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function findUserPanelSubscription(userRowId, serviceType) {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM user_panel_subscriptions
    WHERE user_row_id = ${userRowId} AND service_type = ${serviceType}
    LIMIT 1
  `;
  return rowToSubscription(rows[0]);
}

export async function findPanelSubscriptionByUsername(username) {
  const sql = getSql();
  const normalized = String(username || "").trim();
  if (!normalized) return null;
  const rows = await sql`
    SELECT * FROM user_panel_subscriptions
    WHERE client_username = ${normalized}
    LIMIT 1
  `;
  return rowToSubscription(rows[0]);
}

export async function findUserPanelSubscriptionById(id, userRowId = null) {
  const sql = getSql();
  const rows = userRowId
    ? await sql`
        SELECT * FROM user_panel_subscriptions
        WHERE id = ${id} AND user_row_id = ${userRowId}
        LIMIT 1
      `
    : await sql`
        SELECT * FROM user_panel_subscriptions
        WHERE id = ${id}
        LIMIT 1
      `;
  return rowToSubscription(rows[0]);
}

export async function listUserOutboundSubscriptions(userRowId) {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM user_panel_subscriptions
    WHERE user_row_id = ${userRowId}
      AND service_type IN ('outbound_volume', 'outbound_usage')
    ORDER BY created_at DESC
  `;
  return rows.map(rowToSubscription);
}

export async function countNonDeactivatedOutboundUsageSubscriptions(userRowId) {
  const sql = getSql();
  const rows = await sql`
    SELECT COUNT(*)::int AS count
    FROM user_panel_subscriptions
    WHERE user_row_id = ${userRowId}
      AND service_type = ${OutboundServiceType.USAGE}
      AND status <> 'deactivated'
  `;
  return Number(rows[0]?.count ?? 0);
}

export async function findSubscriptionByClientEmailAndPanel(clientEmail, panelId) {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM user_panel_subscriptions
    WHERE client_username = ${String(clientEmail || "").trim()}
      AND panel_id = ${panelId}
    LIMIT 1
  `;
  return rowToSubscription(rows[0]);
}

export async function getRecentOutboundSubscriptionsByPanel(panelId, limit = 10) {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM user_panel_subscriptions
    WHERE panel_id = ${panelId}
      AND service_type IN ('outbound_volume', 'outbound_usage')
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return rows.map(rowToSubscription);
}

export async function maxOutboundSerialFromDb(panelId, prefix) {
  const sql = getSql();
  const rows = await sql`
    SELECT client_username FROM user_panel_subscriptions
    WHERE panel_id = ${panelId}
      AND service_type IN ('outbound_volume', 'outbound_usage')
      AND client_username ILIKE ${`${prefix}-%`}
  `;
  const { maxOutboundSerialFromNames } = await import("../lib/outboundSubscriptionNaming.js");
  return maxOutboundSerialFromNames(
    rows.map((r) => r.client_username),
    prefix,
  );
}

export async function listUserPanelSubscriptions(userRowId) {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM user_panel_subscriptions
    WHERE user_row_id = ${userRowId}
    ORDER BY created_at DESC
  `;
  return rows.map(rowToSubscription);
}

export async function listUserResellerPanels(userRowId) {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM user_panel_subscriptions
    WHERE user_row_id = ${userRowId}
      AND service_type = ${PanelServiceType.RESELLER}
      AND status IN ('active', 'suspended')
    ORDER BY created_at DESC
  `;
  return rows.map(rowToSubscription);
}

export async function createUserPanelSubscription(input, txOrSql = null) {
  const sql = txOrSql || getSql();
  const lastBilled = input.lastBilledTrafficBytes != null
    ? String(input.lastBilledTrafficBytes)
    : "0";
  const rows = await sql`
    INSERT INTO user_panel_subscriptions (
      user_row_id, panel_id, service_type, client_username, admin_password,
      panel_admin_id, panel_url, status, payment_method, wallet_balance,
      last_billed_traffic_bytes, last_billed_at, prepaid_traffic_bytes,
      connection_link, volume_gb, purchase_amount_irt
    ) VALUES (
      ${input.userRowId},
      ${input.panelId},
      ${input.serviceType},
      ${input.clientUsername},
      ${input.adminPassword ?? null},
      ${input.panelAdminId ?? null},
      ${input.panelUrl},
      ${input.status ?? "active"},
      ${input.paymentMethod ?? null},
      ${input.walletBalance ?? 0},
      ${lastBilled},
      ${input.lastBilledAt === undefined ? (input.lastBilledTrafficBytes != null ? new Date() : null) : input.lastBilledAt},
      ${input.prepaidTrafficBytes != null ? String(input.prepaidTrafficBytes) : "0"},
      ${input.connectionLink ?? null},
      ${input.volumeGb ?? 0},
      ${input.purchaseAmountIrt ?? null}
    )
    RETURNING *
  `;
  return rowToSubscription(rows[0]);
}

export async function updateUserPanelSubscription(id, patch) {
  const sql = getSql();
  const columns = [];
  const values = {};

  if (patch.serviceType !== undefined) {
    values.service_type = patch.serviceType;
    columns.push("service_type");
  }
  if (patch.clientUsername !== undefined) {
    values.client_username = patch.clientUsername;
    columns.push("client_username");
  }
  if (patch.adminPassword !== undefined) {
    values.admin_password = patch.adminPassword;
    columns.push("admin_password");
  }
  if (patch.panelId !== undefined) {
    values.panel_id = patch.panelId;
    columns.push("panel_id");
  }
  if (patch.panelAdminId !== undefined) {
    values.panel_admin_id = patch.panelAdminId;
    columns.push("panel_admin_id");
  }
  if (patch.panelUrl !== undefined) {
    values.panel_url = patch.panelUrl;
    columns.push("panel_url");
  }
  if (patch.status !== undefined) {
    values.status = patch.status;
    columns.push("status");
  }
  if (patch.paymentMethod !== undefined) {
    values.payment_method = patch.paymentMethod;
    columns.push("payment_method");
  }
  if (patch.walletBalance !== undefined) {
    values.wallet_balance = patch.walletBalance;
    columns.push("wallet_balance");
  }
  if (patch.lastBilledTrafficBytes !== undefined) {
    values.last_billed_traffic_bytes = String(patch.lastBilledTrafficBytes);
    columns.push("last_billed_traffic_bytes");
  }
  if (patch.prepaidTrafficBytes !== undefined) {
    values.prepaid_traffic_bytes = String(patch.prepaidTrafficBytes);
    columns.push("prepaid_traffic_bytes");
  }
  if (patch.lastBilledAt !== undefined) {
    values.last_billed_at = patch.lastBilledAt;
    columns.push("last_billed_at");
  }
  if (patch.lowBalanceNotified !== undefined) {
    values.low_balance_notified = Boolean(patch.lowBalanceNotified);
    columns.push("low_balance_notified");
  }
  if (patch.lowBalance5GbNotified !== undefined) {
    values.low_balance_5gb_notified = Boolean(patch.lowBalance5GbNotified);
    columns.push("low_balance_5gb_notified");
  }
  if (patch.suspendedNotified !== undefined) {
    values.suspended_notified = Boolean(patch.suspendedNotified);
    columns.push("suspended_notified");
  }
  if (patch.connectionLink !== undefined) {
    values.connection_link = patch.connectionLink;
    columns.push("connection_link");
  }
  if (patch.volumeGb !== undefined) {
    values.volume_gb = patch.volumeGb;
    columns.push("volume_gb");
  }
  if (patch.purchaseAmountIrt !== undefined) {
    values.purchase_amount_irt = patch.purchaseAmountIrt;
    columns.push("purchase_amount_irt");
  }
  if (patch.volumeRemaining15GbNotified !== undefined) {
    values.volume_remaining_15gb_notified = Boolean(patch.volumeRemaining15GbNotified);
    columns.push("volume_remaining_15gb_notified");
  }
  if (patch.volumeRemaining10GbNotified !== undefined) {
    values.volume_remaining_10gb_notified = Boolean(patch.volumeRemaining10GbNotified);
    columns.push("volume_remaining_10gb_notified");
  }
  if (patch.volumeRemaining5GbNotified !== undefined) {
    values.volume_remaining_5gb_notified = Boolean(patch.volumeRemaining5GbNotified);
    columns.push("volume_remaining_5gb_notified");
  }
  if (patch.exhaustedNotified !== undefined) {
    values.exhausted_notified = Boolean(patch.exhaustedNotified);
    columns.push("exhausted_notified");
  }

  if (columns.length === 0) {
    const rows = await sql`SELECT * FROM user_panel_subscriptions WHERE id = ${id} LIMIT 1`;
    return rowToSubscription(rows[0]);
  }

  const rows = await sql`
    UPDATE user_panel_subscriptions
    SET ${sql(values, columns)}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return rowToSubscription(rows[0]);
}

/**
 * Move amount from user's main wallet into a panel's dedicated wallet.
 */
export async function allocateToPanelWallet({ userRowId, telegramId, subscriptionId, amount }) {
  const sql = getSql();
  const amountIrt = Math.trunc(Number(amount) || 0);
  if (!Number.isFinite(amountIrt) || amountIrt < 1000) {
    const err = new Error("حداقل مبلغ تخصیص ۱٬۰۰۰ تومان است");
    err.status = 400;
    err.code = "INVALID_AMOUNT";
    throw err;
  }

  return sql.begin(async (tx) => {
    const [user] = await tx`
      SELECT id, balance FROM users
      WHERE id = ${userRowId}
      FOR UPDATE
    `;
    if (!user) {
      const err = new Error("کاربر یافت نشد");
      err.status = 404;
      throw err;
    }
    const balance = Number(user.balance) || 0;
    if (balance < amountIrt) {
      const err = new Error("موجودی کیف پول کافی نیست");
      err.status = 402;
      err.code = "INSUFFICIENT_BALANCE";
      throw err;
    }

    const [sub] = await tx`
      SELECT * FROM user_panel_subscriptions
      WHERE id = ${subscriptionId}
        AND user_row_id = ${userRowId}
        AND status IN ('active', 'suspended')
      FOR UPDATE
    `;
    if (!sub) {
      const err = new Error("پنل یافت نشد");
      err.status = 404;
      throw err;
    }

    await tx`
      UPDATE users
      SET balance = balance - ${amountIrt}
      WHERE id = ${userRowId}
    `;

    const [updated] = await tx`
      UPDATE user_panel_subscriptions
      SET wallet_balance = wallet_balance + ${amountIrt}, updated_at = NOW()
      WHERE id = ${subscriptionId}
      RETURNING *
    `;

    return {
      subscription: rowToSubscription(updated),
      userBalance: balance - amountIrt,
      allocated: amountIrt,
      action: "increase",
      telegramId,
    };
  });
}

/**
 * Move amount from a panel's dedicated wallet back into user's main wallet.
 */
export async function withdrawFromPanelWallet({ userRowId, telegramId, subscriptionId, amount }) {
  const sql = getSql();
  const amountIrt = Math.trunc(Number(amount) || 0);
  if (!Number.isFinite(amountIrt) || amountIrt < 1000) {
    const err = new Error("حداقل مبلغ کسر ۱٬۰۰۰ تومان است");
    err.status = 400;
    err.code = "INVALID_AMOUNT";
    throw err;
  }

  return sql.begin(async (tx) => {
    const [user] = await tx`
      SELECT id, balance FROM users
      WHERE id = ${userRowId}
      FOR UPDATE
    `;
    if (!user) {
      const err = new Error("کاربر یافت نشد");
      err.status = 404;
      throw err;
    }

    const [sub] = await tx`
      SELECT * FROM user_panel_subscriptions
      WHERE id = ${subscriptionId}
        AND user_row_id = ${userRowId}
        AND status IN ('active', 'suspended')
      FOR UPDATE
    `;
    if (!sub) {
      const err = new Error("پنل یافت نشد");
      err.status = 404;
      throw err;
    }

    const panelBalance = Number(sub.wallet_balance) || 0;
    if (panelBalance < amountIrt) {
      const err = new Error("موجودی کیف پول پنل کافی نیست");
      err.status = 400;
      err.code = "INSUFFICIENT_PANEL_BALANCE";
      throw err;
    }

    const userBalance = Number(user.balance) || 0;

    await tx`
      UPDATE users
      SET balance = balance + ${amountIrt}
      WHERE id = ${userRowId}
    `;

    const [updated] = await tx`
      UPDATE user_panel_subscriptions
      SET wallet_balance = wallet_balance - ${amountIrt}, updated_at = NOW()
      WHERE id = ${subscriptionId}
      RETURNING *
    `;

    return {
      subscription: rowToSubscription(updated),
      userBalance: userBalance + amountIrt,
      withdrawn: amountIrt,
      allocated: amountIrt,
      action: "decrease",
      telegramId,
    };
  });
}
