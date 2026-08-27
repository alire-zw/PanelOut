import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Validates Telegram Mini App initData (HMAC-SHA256).
 * @see https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function validateTelegramInitData(
  initData,
  botToken,
  { maxAgeSeconds = 86400 } = {},
) {
  if (!initData || typeof initData !== "string") {
    throw Object.assign(new Error("Missing Telegram init data"), { status: 401 });
  }

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) {
    throw Object.assign(new Error("Invalid Telegram init data"), { status: 401 });
  }

  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const computed = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const computedBuf = Buffer.from(computed, "hex");
  const hashBuf = Buffer.from(hash, "hex");
  if (
    computedBuf.length !== hashBuf.length ||
    !timingSafeEqual(computedBuf, hashBuf)
  ) {
    throw Object.assign(new Error("Telegram init data signature mismatch"), {
      status: 401,
    });
  }

  const authDate = Number(params.get("auth_date") || 0);
  if (!authDate) {
    throw Object.assign(new Error("Invalid Telegram auth_date"), { status: 401 });
  }

  const age = Math.floor(Date.now() / 1000) - authDate;
  if (maxAgeSeconds > 0 && age > maxAgeSeconds) {
    throw Object.assign(new Error("Telegram init data expired"), { status: 401 });
  }

  const userRaw = params.get("user");
  if (!userRaw) {
    throw Object.assign(new Error("Telegram user missing in init data"), {
      status: 401,
    });
  }

  let user;
  try {
    user = JSON.parse(userRaw);
  } catch {
    throw Object.assign(new Error("Invalid Telegram user payload"), { status: 401 });
  }

  if (!user?.id) {
    throw Object.assign(new Error("Telegram user id missing"), { status: 401 });
  }

  return {
    user,
    authDate,
    queryId: params.get("query_id") || null,
    startParam: params.get("start_param") || null,
  };
}

export function extractInitData(req) {
  const auth = req.headers.authorization || "";
  if (auth.toLowerCase().startsWith("tma ")) {
    return auth.slice(4).trim();
  }

  const header =
    req.headers["x-telegram-init-data"] ||
    req.headers["x-telegram-initdata"];
  if (typeof header === "string" && header.trim()) {
    return header.trim();
  }

  return null;
}
