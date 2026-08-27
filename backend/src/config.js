import "dotenv/config";
import { generateSecret } from "./lib/security.js";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function normalizeBaseUrl(url) {
  return url.replace(/\/+$/, "");
}

const isProd =
  process.env.NODE_ENV === "production" ||
  process.env.PANELOUT_ENV === "production";

const baseUrl = normalizeBaseUrl(
  process.env.BASE_URL?.trim() || "https://pnldevb.mirall.ir",
);

// Prefer a non-root webhook path so random POSTs to / are ignored.
let webhookPath = process.env.WEBHOOK_PATH?.trim() || "/telegram/webhook";
if (!webhookPath.startsWith("/")) webhookPath = `/${webhookPath}`;

const webhookSecret =
  process.env.WEBHOOK_SECRET?.trim() ||
  // Dev fallback — always set WEBHOOK_SECRET in real deployments
  generateSecret(24);

export const config = {
  isProd,
  port: Number(process.env.PORT || 5424),
  baseUrl,
  webhookPath,
  webhookSecret,
  get webhookUrl() {
    if (this.webhookPath === "/") return this.baseUrl;
    return `${this.baseUrl}${this.webhookPath}`;
  },
  botToken: required("BOT_TOKEN"),
  miniAppUrl: required("MINI_APP_URL"),
  telegramAppUrl:
    process.env.TELEGRAM_APP_URL?.trim() || "https://t.me/PanelOutBot/app",
  databaseUrl: required("DATABASE_URL"),
  redisUrl: process.env.REDIS_URL?.trim() || "redis://localhost:6379",
  /** Optional default support Telegram username (without @) */
  supportTelegramUsername:
    process.env.SUPPORT_TELEGRAM_USERNAME?.trim() || "",

  /** initData max age */
  authMaxAgeReadSec: Number(process.env.AUTH_MAX_AGE_READ_SEC || 3600),
  authMaxAgeWriteSec: Number(process.env.AUTH_MAX_AGE_WRITE_SEC || 900),
  authMaxAgeAdminSec: Number(process.env.AUTH_MAX_AGE_ADMIN_SEC || 600),

  get corsOrigins() {
    const list = new Set([this.miniAppUrl]);
    if (!this.isProd || process.env.ALLOW_LOCAL_CORS === "1") {
      list.add("http://localhost:2344");
      list.add("http://127.0.0.1:2344");
    }
    return [...list].filter(Boolean);
  },
};
