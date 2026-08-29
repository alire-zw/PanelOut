import {
  PasarGuardClient,
  normalizePasarGuardBaseUrl,
  parsePasarGuardPanelUrl,
} from "./pasarguardClient.js";

const clientCache = new Map();

function buildBaseUrl(panel) {
  const domain = String(panel?.panelUrl || panel?.serverDomain || panel?.host || "").trim();
  if (!domain) throw new Error("آدرس پنل تنظیم نشده است");

  if (/^https?:\/\//i.test(domain)) {
    return normalizePasarGuardBaseUrl(domain);
  }

  const port = Number(panel?.port) || 443;
  const proto = port === 443 ? "https" : "http";
  const host = port === 443 || port === 80 ? domain : `${domain}:${port}`;
  return normalizePasarGuardBaseUrl(`${proto}://${host}`);
}

function clientCacheKey(panel) {
  const pwd = String(panel?.adminPassword || "");
  const pwdKey = pwd ? `${pwd.length}:${pwd.slice(0, 2)}${pwd.slice(-2)}` : "0";
  return `${panel?.id ?? "new"}:${buildBaseUrl(panel)}:${panel?.adminUsername}:${pwdKey}`;
}

function getClient(panel, { fresh = false } = {}) {
  const key = clientCacheKey(panel);
  if (!fresh && clientCache.has(key)) {
    return clientCache.get(key);
  }

  const client = new PasarGuardClient({
    baseUrl: buildBaseUrl(panel),
    username: String(panel.adminUsername || "").trim(),
    password: String(panel.adminPassword || ""),
  });

  clientCache.set(key, client);
  return client;
}

export function clearPasarGuardClientCache(panel) {
  clientCache.delete(clientCacheKey(panel));
}

export async function verifyPasarGuardConnection(panelLike) {
  try {
    const client = getClient(panelLike, { fresh: true });
    const health = await client.healthCheck();

    if (health?.status !== "ok") {
      return {
        success: false,
        error: `Health check failed: ${JSON.stringify(health)}`,
      };
    }

    await client.authenticate();
    return { success: true };
  } catch (err) {
    if (err.status === 401) {
      return {
        success: false,
        error: "احراز هویت پنل PasarGuard ناموفق بود. یوزر/پسورد ادمین را بررسی کنید.",
      };
    }
    return { success: false, error: err.message || String(err) };
  }
}

export async function getPasarGuardStats(panel) {
  try {
    const client = getClient(panel);
    const [sys, adminsPayload] = await Promise.all([
      client.getSystemInfo(),
      client
        .getAdminsSimple({ all: true })
        .catch(() => client.getAdmins({ limit: 1000 }).catch(() => null)),
    ]);

    const uptimeSeconds = Number(sys.uptime_seconds ?? sys.uptime ?? 0) || 0;
    const adminsList = Array.isArray(adminsPayload)
      ? adminsPayload
      : Array.isArray(adminsPayload?.admins)
        ? adminsPayload.admins
        : [];
    const adminCount = Number(
      adminsPayload?.total ?? adminsList.length ?? 0,
    );
    const adminUsernames = adminsList
      .map((item) => (typeof item === "string" ? item : item?.username))
      .filter(Boolean)
      .map((u) => String(u).trim().toLowerCase());

    return {
      success: true,
      stats: {
        totalUsers: Number(sys.total_user) || 0,
        onlineUsers: Number(sys.online_users) || 0,
        activeUsers: Number(sys.active_users) || 0,
        incomingBandwidth: Number(sys.incoming_bandwidth) || 0,
        outgoingBandwidth: Number(sys.outgoing_bandwidth) || 0,
        totalTraffic:
          (Number(sys.incoming_bandwidth) || 0) + (Number(sys.outgoing_bandwidth) || 0),
        version: sys.version ?? null,
        uptime: uptimeSeconds,
        memory: sys.mem_total != null ? { total: sys.mem_total, used: sys.mem_used } : null,
        cpuCores: sys.cpu_cores ?? null,
        adminCount,
      },
      adminUsernames,
    };
  } catch (err) {
    return { success: false, stats: null, adminUsernames: [], error: err.message || String(err) };
  }
}

export function formatBytes(bytes) {
  if (bytes == null || bytes === 0 || Number.isNaN(bytes)) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const num = typeof bytes === "string" ? Number.parseFloat(bytes) : Number(bytes);
  const i = Math.min(Math.floor(Math.log(num) / Math.log(k)), sizes.length - 1);
  return `${(num / k ** i).toFixed(2)} ${sizes[i]}`;
}

export { parsePasarGuardPanelUrl, buildBaseUrl };
