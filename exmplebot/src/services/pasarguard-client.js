import { env } from "../config/env.js";

export const DEFAULT_PASARGUARD_TIMEOUT_MS = 30_000;
export const DEFAULT_PASARGUARD_MAX_RETRIES = 3;
export const PASARGUARD_RETRY_BASE_DELAY_MS = 500;

export function getDefaultPasarGuardClientOptions(overrides = {}) {
  return {
    timeoutMs: env.pasarguardTimeoutMs,
    maxRetries: env.pasarguardMaxRetries,
    ...overrides,
  };
}

export function isRetryablePasarGuardError(err) {
  if (!err) {
    return false;
  }

  if (err.status != null && err.status >= 400 && err.status !== 401) {
    return false;
  }

  const message = String(err.message || err.cause?.message || "").toLowerCase();

  return (
    err.name === "AbortError" ||
    err.name === "TypeError" ||
    /fetch failed|network|econnreset|econnrefused|etimedout|enotfound|socket hang up|timed out|timeout|dns|getaddrinfo/.test(
      message,
    )
  );
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retryPasarGuardRequest(fn, { maxRetries = DEFAULT_PASARGUARD_MAX_RETRIES } = {}) {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;

      if (!isRetryablePasarGuardError(err) || attempt >= maxRetries - 1) {
        throw err;
      }

      await delay(PASARGUARD_RETRY_BASE_DELAY_MS * (attempt + 1));
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
      timeoutMs: DEFAULT_PASARGUARD_TIMEOUT_MS,
      maxRetries: DEFAULT_PASARGUARD_MAX_RETRIES,
      ...config,
      baseUrl: normalizePasarGuardBaseUrl(config.baseUrl),
    };
    this.accessToken = null;
  }

  async request(path, options = {}) {
    const maxRetries = Number(this.config.maxRetries) || DEFAULT_PASARGUARD_MAX_RETRIES;

    return retryPasarGuardRequest(
      async (attempt) => this.requestOnce(path, { ...options, _networkAttempt: attempt }),
      { maxRetries },
    );
  }

  async requestOnce(path, options = {}) {
    const {
      skipAuth = false,
      _authRetried = false,
      _networkAttempt = 0,
      ...fetchOptions
    } = options;
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
    return retryPasarGuardRequest(
      async () => this.authenticateOnce(),
      { maxRetries: Number(this.config.maxRetries) || DEFAULT_PASARGUARD_MAX_RETRIES },
    );
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

  getUsers(params = {}) {
    const query = new URLSearchParams();
    if (params.offset != null) query.set("offset", String(params.offset));
    if (params.limit != null) query.set("limit", String(params.limit));
    if (Array.isArray(params.username)) {
      for (const name of params.username) {
        query.append("username", name);
      }
    }
    const qs = query.toString();
    return this.request(qs ? `/api/users?${qs}` : "/api/users");
  }

  getUser(username) {
    return this.request(`/api/user/${encodeURIComponent(username)}`);
  }

  createUser(body) {
    return this.request("/api/user", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  modifyUser(username, body) {
    return this.request(`/api/user/${encodeURIComponent(username)}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  }

  getAdminRolesSimple() {
    return this.request("/api/admin-roles/simple");
  }

  getAdmins(params = {}) {
    const query = new URLSearchParams();

    if (params.offset != null) query.set("offset", String(params.offset));
    if (params.limit != null) query.set("limit", String(params.limit));
    if (params.username) query.set("username", params.username);

    if (Array.isArray(params.usernames)) {
      for (const name of params.usernames) {
        query.append("usernames", name);
      }
    }

    const qs = query.toString();
    return this.request(qs ? `/api/admins?${qs}` : "/api/admins");
  }

  async getAdmin(username) {
    const apiUsername = String(username || "").trim();
    const data = await this.getAdmins({ username: apiUsername, limit: 1 });
    const admin = (data?.admins || []).find(
      (row) =>
        String(row?.username || "").toLowerCase() === apiUsername.toLowerCase(),
    );

    if (!admin) {
      const err = new Error(`HTTP 404 /api/admins: admin not found`);
      err.status = 404;
      throw err;
    }

    return admin;
  }

  createAdmin(body) {
    return this.request("/api/admin", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  modifyAdmin(username, body) {
    return this.request(`/api/admin/${encodeURIComponent(username)}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  }

  disableAllAdminActiveUsers(username) {
    return this.request(`/api/admin/${encodeURIComponent(username)}/users/disable`, {
      method: "POST",
    });
  }

  activateAllAdminDisabledUsers(username) {
    return this.request(`/api/admin/${encodeURIComponent(username)}/users/activate`, {
      method: "POST",
    });
  }

  getAdminRole(roleId) {
    return this.request(`/api/admin-role/${roleId}`);
  }

  createAdminRole(body) {
    return this.request("/api/admin-role", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  modifyAdminRole(roleId, body) {
    return this.request(`/api/admin-role/${roleId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  }

  deleteAdminRole(roleId) {
    return this.request(`/api/admin-role/${roleId}`, {
      method: "DELETE",
    });
  }
}

export function normalizePasarGuardBaseUrl(raw) {
  return String(raw || "")
    .trim()
    .replace(/\/dashboard\/?$/i, "")
    .replace(/\/+$/, "");
}

export function parsePasarGuardPanelUrl(raw) {
  const input = String(raw || "").trim();

  if (!input) throw new Error("آدرس پنل خالی است");

  const withProto = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  const url = new URL(withProto);
  const baseUrl = normalizePasarGuardBaseUrl(url.origin);

  return {
    baseUrl,
    serverIp: url.hostname,
    serverDomain: baseUrl,
    port: url.port ? parseInt(url.port, 10) : url.protocol === "https:" ? 443 : 80,
  };
}
