import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3000),
  DB_HOST: z.string().default('localhost'),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().default(''),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  REDIS_URL: z.string().min(1),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_BOT_SECRET: z.string().min(32),
  /** Optional Bot API root (useful when api.telegram.org is blocked). */
  TELEGRAM_API_ROOT: z.string().url().default('https://api.telegram.org'),
  PUBLIC_URL: z.string().url(),
  WEBHOOK_PATH: z.string().startsWith('/').default('/bot/webhook'),
  MINI_APP_URL: z.string().url(),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  TRUST_PROXY: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  ZIBAL_MERCHANT: z.string().min(1).default('zibal'),
  ZIBAL_GATEWAY_URL: z.string().url().default('https://gateway.zibal.ir'),
  ZIBAL_FACILITY_BASE_URL: z.string().url().default('https://api.zibal.ir'),
  ZIBAL_FACILITY_ACCESS_TOKEN: z.string().default(''),
  TRON_NETWORK: z.enum(['shasta', 'mainnet']).default('shasta'),
  TRON_MASTER_ADDRESS: z.string().min(1),
  TRONGRID_API_KEY: z.string().min(1),
  SWAPWALLET_API_KEY: z.string().min(1),
  SWAPWALLET_API_URL: z.string().url().default('https://swapwallet.app/api'),
  SWAPWALLET_APP_NAME: z.string().min(1).default('viraltel'),
  MARKETAPP_API_URL: z.string().url().default('https://api.marketapp.org'),
  MARKETAPP_API_TOKEN: z.string().min(1),
  CALLINOO_API_URL: z.string().url().default('https://api.ozvinoo.xyz'),
  CALLINOO_API_TOKEN: z.string().min(1),
  POWERTEL_API_URL: z.string().url().default('https://api.power-tel.ir/v2/'),
  POWERTEL_API_KEY: z.string().min(1),
  CANBOSO_API_URL: z.string().url().default('https://canboso.com'),
  CANBOSO_BUYER_API_KEY: z.string().min(1),
  ROBOTICVN_API_URL: z.string().url().default('https://api.roboticvn.com'),
  ROBOTICVN_API_KEY: z.string().min(1).default(''),
  SMSIR_API_URL: z.string().url().default('https://api.sms.ir/v1'),
  SMSIR_API_KEY: z.string().min(1),
  SMSIR_VERIFY_TEMPLATE_ID: z.coerce.number().int().positive(),
  SMSIR_VERIFY_PARAM_NAME: z.string().min(1).default('Code'),
  SMSIR_ACCOUNT_ORDER_RECEIVED_TEMPLATE_ID: z.coerce.number().int().positive().default(449030),
  SMSIR_ACCOUNT_ORDER_DELIVERED_TEMPLATE_ID: z.coerce.number().int().positive().default(449030),
  SMSIR_ACCOUNT_ORDER_PARAM_NAME: z.string().min(1).default('ORDER_ID'),
  /**
   * Temporary browser access for e-namad / SMS template review.
   * When true, APIs accept Authorization Bearer sessions and OTP login is enabled.
   * Keep false in normal production once approvals are done.
   */
  BROWSER_PUBLIC_MODE: z
    .string()
    .optional()
    .transform((value) => value === 'true' || value === '1'),
  /** HMAC secret for browser session tokens. Falls back to bot token if omitted. */
  BROWSER_SESSION_SECRET: z.string().min(16).optional(),
  BROWSER_SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(7 * 24 * 60 * 60),
  TRON_CRON_INTERVAL_MS: z.coerce.number().int().positive().default(15_000),
  CRYPTO_PAYMENT_TTL_MINUTES: z.coerce.number().int().positive().default(10),
  /** Comma-separated Telegram numeric IDs of the two main admins. */
  MAIN_ADMIN_TELEGRAM_IDS: z
    .string()
    .min(1)
    .transform((value) =>
      value
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean),
    )
    .pipe(
      z
        .array(z.string().regex(/^\d+$/, 'Telegram ID must be numeric'))
        .length(2, 'Exactly two main admin Telegram IDs are required'),
    ),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data

function buildDatabaseUrl(): string {
  const user = encodeURIComponent(env.DB_USER)
  const password = encodeURIComponent(env.DB_PASSWORD)
  const auth = env.DB_PASSWORD ? `${user}:${password}` : user
  const name = encodeURIComponent(env.DB_NAME)

  return `mysql://${auth}@${env.DB_HOST}:${env.DB_PORT}/${name}`
}

export const databaseUrl = buildDatabaseUrl()
process.env.DATABASE_URL = databaseUrl

export const webhookUrl = `${env.PUBLIC_URL.replace(/\/$/, '')}${env.WEBHOOK_PATH}`
export const zibalCallbackUrl = `${env.PUBLIC_URL.replace(/\/$/, '')}/api/payments/callback`

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/$/, '')
}

export const corsOrigins = [
  ...new Set([
    ...env.CORS_ORIGINS.split(',').map(normalizeOrigin).filter(Boolean),
    normalizeOrigin(env.MINI_APP_URL),
  ]),
]
