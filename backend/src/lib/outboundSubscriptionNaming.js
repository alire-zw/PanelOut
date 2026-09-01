/** PasarGuard usernames: [a-zA-Z0-9-_@.] only, no consecutive specials. */
function sanitizePasarGuardUsernamePart(value) {
  const slug = String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^a-zA-Z0-9-_@.]/g, "")
    .replace(/[-_@.]{2,}/g, "-")
    .replace(/^[-_@.]+|[-_@.]+$/g, "");

  return slug;
}

function fallbackOutboundRemarkSlug(panel) {
  const id = String(panel?.id || "").trim();
  if (id) return `p${id}`;

  const host = String(panel?.host || panel?.panelUrl || "")
    .replace(/^https?:\/\//i, "")
    .split(/[/?#]/)[0]
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 32);

  return host || "srv";
}

export function resolveOutboundRemarkSlug(panel) {
  const remark = String(panel?.remark ?? panel?.name ?? "").trim();
  const slug = sanitizePasarGuardUsernamePart(remark);
  if (slug) return slug;
  return fallbackOutboundRemarkSlug(panel);
}

export function buildOutboundSubscriptionPrefix(panel) {
  return `OutBounds-${resolveOutboundRemarkSlug(panel)}`;
}

export function buildOutboundClientEmail(panel, serial) {
  return `${buildOutboundSubscriptionPrefix(panel)}-${serial}`;
}

export function extractOutboundSerial(clientEmail) {
  const match = String(clientEmail || "").trim().match(/-(\d+)$/);
  if (!match) return null;
  const num = Number.parseInt(match[1], 10);
  return Number.isInteger(num) && num >= 1 ? num : null;
}

export function matchesOutboundSubscriptionPrefix(clientEmail, prefix) {
  const normalized = String(clientEmail || "").trim();
  if (!normalized.startsWith(`${prefix}-`)) return false;
  return extractOutboundSerial(normalized) != null;
}

export function maxOutboundSerialFromNames(names, prefix) {
  let max = 0;

  for (const name of names || []) {
    if (!matchesOutboundSubscriptionPrefix(name, prefix)) continue;
    const serial = extractOutboundSerial(name);
    if (serial != null) max = Math.max(max, serial);
  }

  return max;
}

export function outboundSubscriptionNameKey(name) {
  return String(name || "").trim().toLowerCase();
}
