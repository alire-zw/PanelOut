import { initPostgres, closePostgres, getSql } from "../src/db/postgres.js";
import { findPasarGuardPanelById } from "../src/db/pasarguardPanels.js";
import {
  clearPanelAdminHwidLimits,
  getProvisionClient,
  needsPanelAdminHwidPatch,
} from "../src/lib/panelProvision.js";

await initPostgres();
const sql = getSql();

const subs = await sql`
  SELECT DISTINCT client_username, panel_id, service_type
  FROM user_panel_subscriptions
  WHERE service_type IN ('panel_trial', 'panel_usage', 'panel_unlimited', 'panel_reseller')
    AND status != 'deactivated'
  ORDER BY panel_id, client_username
`;

console.log(`Checking ${subs.length} panel admin accounts...`);

const panelCache = new Map();
let updated = 0;
let alreadyClear = 0;
let notFound = 0;
let failed = 0;

for (const row of subs) {
  const panelId = String(row.panel_id);
  let panel = panelCache.get(panelId);
  if (!panel) {
    panel = await findPasarGuardPanelById(panelId, { includePassword: true });
    panelCache.set(panelId, panel);
  }

  if (!panel) {
    console.log(`SKIP panel missing: ${panelId} / ${row.client_username}`);
    failed += 1;
    continue;
  }

  try {
    const client = getProvisionClient(panel);
    const admin = await client.getAdmin(row.client_username);

    if (!needsPanelAdminHwidPatch(admin)) {
      console.log(`OK  ${row.client_username} @ panel ${panelId} (${row.service_type})`);
      alreadyClear += 1;
      continue;
    }

    const result = await clearPanelAdminHwidLimits(panel, row.client_username);
    if (result.updated) {
      console.log(`FIX ${row.client_username} @ panel ${panelId} (${row.service_type})`);
      updated += 1;
    } else if (result.reason === "not_found") {
      console.log(`404 ${row.client_username} @ panel ${panelId}`);
      notFound += 1;
    } else {
      alreadyClear += 1;
    }
  } catch (err) {
    console.log(`ERR ${row.client_username} @ panel ${panelId}: ${err.message}`);
    failed += 1;
  }
}

console.log("\nSummary:");
console.log(`  updated: ${updated}`);
console.log(`  already clear: ${alreadyClear}`);
console.log(`  not found: ${notFound}`);
console.log(`  failed: ${failed}`);

await closePostgres();
