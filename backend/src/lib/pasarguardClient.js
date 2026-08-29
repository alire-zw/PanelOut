const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 500;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalizePasarGuardBaseUrl(raw) {
  return String(raw || "")
    .trim()
    .replace(/\/dashboard\/?$/i, "")
    .replace(/\/+$/, "");
}

export function parsePasarGuardPanelUrl(raw) {
  const input = String(raw || "").trim();
  if (!input) {
    throw new Error("آدرس پنل خالی است");
  }

  const withProto = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  const url = new URL(withProto);
  const baseUrl = normalizePasarGuardBaseUrl(url.origin);

  return {
    baseUrl,
    host: url.hostname,
    port: url.port ? Number.parseInt(url.port, 10) : url.protocol === "https:" ? 443 : 80,
  };
}

function isRetryableError(err) {
  if (!err) return false;
  if (err.status != null && err.status >= 400 && err.status !== 401) return false;

  const message = String(err.message || err.cause?.message || "").toLowerCase();
  return (
    err.name === "AbortError" ||
    err.name === "TypeError" ||
    /fetch failed|network|econnreset|econnrefused|etimedout|enotfound|socket hang up|timed out|timeout|dns|getaddrinfo/.test(
      message,
    )
  );
}

async function retryRequest(fn, maxRetries = DEFAULT_MAX_RETRIES) {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      if (!isRetryableError(err) || attempt >= maxRetries - 1) {
        throw err;
      }
      await delay(RETRY_BASE_DELAY_MS * (attempt + 1));
    }
  }

  throw lastError;
}

export class PasarGuardClient {
  constructor(config) {
    if (!config?.baseUrl) throw new Error("PasarGuard baseUrl is required");
    if (!config?.username) throw new Error("PasarGuard username is required");
    if (!config?.password) throw new Error("PasarGuard password is required");

    this.config = {
      timeoutMs: DEFAULT_TIMEOUT_MS,
      maxRetries: DEFAULT_MAX_RETRIES,
      ...config,
      baseUrl: normalizePasarGuardBaseUrl(config.baseUrl),
    };
    this.accessToken = null;
  }

  async request(path, options = {}) {
    const maxRetries = Number(this.config.maxRetries) || DEFAULT_MAX_RETRIES;
    return retryRequest(
      async (attempt) => this.requestOnce(path, { ...options, _networkAttempt: attempt }),
      maxRetries,
    );
  }

  async requestOnce(path, options = {}) {
    const { skipAuth = false, _authRetried = false, ...fetchOptions } = options;
    const url = `${this.config.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const headers = new Headers(fetchOptions.headers || {});

    if (!skipAuth) {
      if (!this.accessToken) await this.authenticateOnce();
      headers.set("Authorization", `Bearer ${this.accessToken}`);
    }

    if (fetchOptions.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const res = await fetch(url, { ...fetchOptions, headers, signal: controller.signal });
      const text = await res.text();
      let data = null;

      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }

      if (!res.ok) {
        if (res.status === 401 && !skipAuth && !_authRetried) {
          this.accessToken = null;
          await this.authenticateOnce();
          return this.requestOnce(path, { ...options, _authRetried: true });
        }

        const detail =
          typeof data === "object" && data !== null
            ? data.detail || data.message || JSON.stringify(data)
            : String(data || res.statusText);
        const err = new Error(`HTTP ${res.status} ${path}: ${detail}`);
        err.status = res.status;
        throw err;
      }

      return data;
    } catch (err) {
      if (err.name === "AbortError") {
        throw new Error(`Request timeout after ${this.config.timeoutMs}ms: ${path}`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async authenticate() {
    const maxRetries = Number(this.config.maxRetries) || DEFAULT_MAX_RETRIES;
    return retryRequest(() => this.authenticateOnce(), maxRetries);
  }

  async authenticateOnce() {
    const body = new URLSearchParams({
      username: this.config.username,
      password: this.config.password,
      grant_type: "password",
    }).toString();

    const data = await this.requestOnce("/api/admin/token", {
      method: "POST",
      skipAuth: true,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const token = data?.access_token;
    if (!token) throw new Error("Authentication failed: no access_token");
    this.accessToken = token;
    return token;
  }

  healthCheck() {
    return this.request("/health", { skipAuth: true });
  }

  getSystemInfo() {
    return this.request("/api/system");
  }

  getGroupsSimple(params = {}) {
    const query = new URLSearchParams();
    if (params.all) query.set("all", "true");
    if (params.limit != null) query.set("limit", String(params.limit));
    const qs = query.toString();
    return this.request(qs ? `/api/groups/simple?${qs}` : "/api/groups/simple");
  }

  getAdmins(params = {}) {
    const query = new URLSearchParams();
    if (params.offset != null) query.set("offset", String(params.offset));
    if (params.limit != null) query.set("limit", String(params.limit));
    if (params.username) query.set("username", params.username);
    const qs = query.toString();
    return this.request(qs ? `/api/admins?${qs}` : "/api/admins");
  }

  getAdminsSimple(params = {}) {
    const query = new URLSearchParams();
    if (params.all) query.set("all", "true");
    if (params.limit != null) query.set("limit", String(params.limit));
    const qs = query.toString();
    return this.request(qs ? `/api/admins/simple?${qs}` : "/api/admins/simple");
  }

  createAdmin(body) {
    return this.request("/api/admin", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async getAdmin(username) {
    const apiUsername = String(username || "").trim();
    const data = await this.getAdmins({ username: apiUsername, limit: 1 });
    const admin = (data?.admins || []).find(
      (row) => String(row?.username || "").toLowerCase() === apiUsername.toLowerCase(),
    );
    if (!admin) {
      const err = new Error(`HTTP 404 /api/admins: admin not found`);
      err.status = 404;
      throw err;
    }
    return admin;
  }

  modifyAdmin(username, body) {
    return this.request(`/api/admin/${encodeURIComponent(username)}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  }

  getAdminRolesSimple() {
    return this.request("/api/admin-roles/simple");
  }
}
