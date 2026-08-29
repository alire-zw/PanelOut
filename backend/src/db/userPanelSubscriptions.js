import { getSql } from "./postgres.js";

export const PanelServiceType = Object.freeze({
  TRIAL: "panel_trial",
  USAGE: "panel_usage",
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
        service_type IN ('panel_trial', 'panel_usage', 'panel_unlimited')
      ),
      CONSTRAINT user_panel_subscriptions_status_check CHECK (
        status IN ('active', 'suspended', 'deactivated')
      )
    )
  `);

  await sql.unsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS user_panel_subscriptions_user_type_uidx
    ON user_panel_subscriptions (user_row_id, service_type)
  `);

  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS user_panel_subscriptions_user_idx
    ON user_panel_subscriptions (user_row_id)
  `);
}

function rowToSubscription(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    panelId: String(row.panel_id),
    serviceType: row.service_type,
    clientUsername: row.client_username,
    panelAdminId: row.panel_admin_id != null ? String(row.panel_admin_id) : null,
    panelUrl: row.panel_url,
    status: row.status,
    paymentMethod: row.payment_method,
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

export async function listUserPanelSubscriptions(userRowId) {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM user_panel_subscriptions
    WHERE user_row_id = ${userRowId}
    ORDER BY created_at DESC
  `;
  return rows.map(rowToSubscription);
}

export async function createUserPanelSubscription(input) {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO user_panel_subscriptions (
      user_row_id, panel_id, service_type, client_username,
      panel_admin_id, panel_url, status, payment_method
    ) VALUES (
      ${input.userRowId},
      ${input.panelId},
      ${input.serviceType},
      ${input.clientUsername},
      ${input.panelAdminId ?? null},
      ${input.panelUrl},
      ${input.status ?? "active"},
      ${input.paymentMethod ?? null}
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
