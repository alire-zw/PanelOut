import "dotenv/config";

function requireEnv(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

const webhookUrl = requireEnv("WEBHOOK_URL").replace(/\/$/, "");
const webhookPath = process.env.WEBHOOK_PATH || "/webhook";
const logLevel = (process.env.LOG_LEVEL || "info").toLowerCase();

const validLogLevels = ["debug", "info", "warn", "error", "fatal"];

if (!validLogLevels.includes(logLevel)) {
  throw new Error(
    `Invalid LOG_LEVEL "${logLevel}". Use: ${validLogLevels.join(", ")}`,
  );
}

function parseAdminIds(value) {
  if (!value?.trim()) return new Set();

  const ids = value.split(",").map((id) => {
    const parsed = Number(id.trim());

    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new Error(`Invalid ADMIN_IDS entry: ${id}`);
    }

    return parsed;
  });

  return new Set(ids);
}

const TRON_NETWORK_HOSTS = {
  mainnet: "https://api.trongrid.io",
  shasta: "https://api.shasta.trongrid.io",
};

const tronNetwork = (process.env.TRON_NETWORK || "mainnet").toLowerCase();

if (!TRON_NETWORK_HOSTS[tronNetwork]) {
  throw new Error(
    `Invalid TRON_NETWORK "${tronNetwork}". Use: mainnet, shasta`,
  );
}

export const env = {
  botToken: requireEnv("BOT_TOKEN"),
  port: Number(process.env.PORT) || 4444,
  webhookPath,
  webhookUrl: `${webhookUrl}${webhookPath}`,
  webhookSecret: requireEnv("WEBHOOK_SECRET"),
  databaseUrl: requireEnv("DATABASE_URL"),
  redisUrl: requireEnv("REDIS_URL"),
  logLevel,
  adminIds: parseAdminIds(process.env.ADMIN_IDS),
  tronGridApiKey: requireEnv("TRONGRID_API_KEY"),
  tronNetwork,
  tronFullHost: process.env.TRON_FULL_HOST || TRON_NETWORK_HOSTS[tronNetwork],
  swapwalletApiKey: requireEnv("SWAPWALLET_API_KEY"),
  depositMonitorCron: process.env.DEPOSIT_MONITOR_CRON || "*/30 * * * * *",
  walletSweepCron: process.env.WALLET_SWEEP_CRON || "0 */10 * * * *",
  outboundUsageBillingCron: process.env.OUTBOUND_USAGE_BILLING_CRON || "*/20 * * * * *",
  panelUsageBillingCron: process.env.PANEL_USAGE_BILLING_CRON || "*/20 * * * * *",
  outboundVolumeAlertCron: process.env.OUTBOUND_VOLUME_ALERT_CRON || "0 */5 * * * *",
  faqPublicUrl: (process.env.FAQ_PUBLIC_URL || webhookUrl).replace(/\/$/, "") + "/faq",
  pasarguardTimeoutMs: Number(process.env.PASARGUARD_TIMEOUT_MS) || 30_000,
  pasarguardMaxRetries: Number(process.env.PASARGUARD_MAX_RETRIES) || 3,
  telegramProxy: process.env.TELEGRAM_PROXY?.trim() || null,
  telegramMaxRetries: Number(process.env.TELEGRAM_MAX_RETRIES) || 5,
  webhookHealthCron: process.env.WEBHOOK_HEALTH_CRON || "0 */15 * * * *",
};
