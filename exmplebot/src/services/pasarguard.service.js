import {
  PasarGuardClient,
  getDefaultPasarGuardClientOptions,
  normalizePasarGuardBaseUrl,
  parsePasarGuardPanelUrl,
} from "./pasarguard-client.js";

const clientCache = new Map();

function buildPasarGuardBaseUrl(server) {
  const domain = String(server?.serverDomain || server?.serverIp || "").trim();

  if (!domain) throw new Error("PasarGuard server URL is missing");

  if (/^https?:\/\//i.test(domain)) {
    return normalizePasarGuardBaseUrl(domain);
  }

  const port = Number(server?.port) || 443;
  const proto = port === 443 ? "https" : "http";
  const host = port === 443 || port === 80 ? domain : `${domain}:${port}`;

  return normalizePasarGuardBaseUrl(`${proto}://${host}`);
}

function clientCacheKey(server) {
  const pwd = String(server?.userPassword || "");
  const pwdKey = pwd ? `${pwd.length}:${pwd.slice(0, 2)}${pwd.slice(-2)}` : "0";

  return `${server?.id ?? "new"}:${buildPasarGuardBaseUrl(server)}:${server?.userName}:${pwdKey}`;
}

function getClient(server, { fresh = false } = {}) {
  const key = clientCacheKey(server);

  if (!fresh && clientCache.has(key)) {
    return clientCache.get(key);
  }

  const client = new PasarGuardClient(
    getDefaultPasarGuardClientOptions({
      baseUrl: buildPasarGuardBaseUrl(server),
      username: String(server.userName || "").trim(),
      password: String(server.userPassword || ""),
    }),
  );

  clientCache.set(key, client);
  return client;
}

export function clearPasarGuardClientCache(server) {
  clientCache.delete(clientCacheKey(server));
}

export async function verifyPasarGuardConnection(serverLike) {
  try {
    const client = getClient(serverLike, { fresh: true });
    const health = await client.healthCheck();

    if (health?.status !== "ok") {
      return { success: false, error: `Health check failed: ${JSON.stringify(health)}` };
    }

    await client.authenticate();
    return { success: true };
  } catch (err) {
    if (err.status === 401) {
      return {
        success: false,
        error:
          "احراز هویت پنل PasarGuard ناموفق بود. یوزر/پسورد ادمین پنل را بررسی کنید.",
      };
    }

    return { success: false, error: err.message || String(err) };
  }
}

export async function checkPasarGuardConnection(server) {
  const result = await verifyPasarGuardConnection(server);
  return { success: result.success, error: result.error || null };
}

export async function getPasarGuardStats(server) {
  try {
    const client = getClient(server);
    const sys = await client.getSystemInfo();

    return {
      success: true,
      stats: {
        totalInbounds: Number(sys.total_user) || 0,
        totalClients: Number(sys.total_user) || 0,
        onlineClients: Number(sys.online_users) || 0,
        totalUpload: Number(sys.incoming_bandwidth) || 0,
        totalDownload: Number(sys.outgoing_bandwidth) || 0,
        totalTraffic:
          (Number(sys.incoming_bandwidth) || 0) + (Number(sys.outgoing_bandwidth) || 0),
        version: sys.version,
        activeUsers: sys.active_users,
      },
    };
  } catch (err) {
    return { success: false, stats: null, error: err.message };
  }
}

export { parsePasarGuardPanelUrl, buildPasarGuardBaseUrl };
