export function resolveOutboundRemarkSlug(server) {
  const remark = String(server?.remark ?? server?.serverName ?? "srv").trim();
  const slug = remark.replace(/\s+/g, "");
  return slug || "srv";
}

export function buildOutboundSubscriptionPrefix(server) {
  return `OutBounds-${resolveOutboundRemarkSlug(server)}`;
}

export function buildOutboundClientEmail(server, serial) {
  return `${buildOutboundSubscriptionPrefix(server)}-${serial}`;
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
