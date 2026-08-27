import { env } from '../config/env.js'

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

const levelWeight: Record<LogLevel, number> = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
}

const minLevel: LogLevel = env.NODE_ENV === 'production' ? 'INFO' : 'DEBUG'

export type LogFields = Record<string, string | number | boolean | null | undefined>

const useColor =
  process.env.NO_COLOR == null &&
  process.env.FORCE_COLOR !== '0' &&
  (Boolean(process.stdout.isTTY) ||
    process.env.FORCE_COLOR === '1' ||
    env.NODE_ENV === 'development')

const ansi = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  gray: '\x1b[90m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  white: '\x1b[37m',
} as const

function paint(color: string, text: string): string {
  if (!useColor) {
    return text
  }
  return `${color}${text}${ansi.reset}`
}

const levelStyle: Record<LogLevel, { color: string; label: string }> = {
  DEBUG: { color: ansi.gray, label: 'DEBUG' },
  INFO: { color: ansi.cyan, label: ' INFO' },
  WARN: { color: ansi.yellow, label: ' WARN' },
  ERROR: { color: ansi.red, label: 'ERROR' },
}

const scopeColors: Record<string, string> = {
  APP: ansi.green,
  BOT: ansi.magenta,
  HTTP: ansi.blue,
  DB: ansi.cyan,
  REDIS: ansi.red,
  CRON: ansi.yellow,
  WEBHOOK: ansi.magenta,
}

function formatTime(): string {
  return new Date().toLocaleTimeString('en-GB', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatFields(fields?: LogFields): string {
  if (!fields) {
    return ''
  }

  const parts = Object.entries(fields)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${String(value)}`)

  if (parts.length === 0) {
    return ''
  }

  return ` ${paint(ansi.dim, parts.join(' '))}`
}

function shouldLog(level: LogLevel): boolean {
  return levelWeight[level] >= levelWeight[minLevel]
}

function padScope(scope: string): string {
  return scope.padEnd(8)
}

function write(level: LogLevel, scope: string, message: string, fields?: LogFields): void {
  if (!shouldLog(level)) {
    return
  }

  const style = levelStyle[level]
  const scopeColor = scopeColors[scope] ?? ansi.white
  const time = paint(ansi.dim, formatTime())
  const levelLabel = paint(style.color, style.label)
  const scopeLabel = paint(scopeColor, padScope(scope))
  const text = message.trim() || '(no message)'

  const line = `${time} ${levelLabel} ${scopeLabel} ${text}${formatFields(fields)}`
  if (level === 'ERROR') {
    console.error(line)
  } else if (level === 'WARN') {
    console.warn(line)
  } else {
    console.log(line)
  }
}

function redactSecrets(text: string): string {
  return text
    .replace(/bot\d+:[A-Za-z0-9_-]+/g, 'bot<redacted>')
    .replace(/\b\d{8,12}:[A-Za-z0-9_-]{30,}\b/g, '<bot-token>')
}

export function formatError(error: unknown): string {
  if (error == null) {
    return 'Unknown error'
  }

  if (typeof error === 'string') {
    return redactSecrets(error.trim() || 'Unknown error')
  }

  if (error instanceof Error) {
    const withExtra = error as Error & {
      description?: string
      error_code?: number
      method?: string
      code?: string
      errno?: number
      address?: string
      port?: number
      errors?: unknown[]
      error?: unknown
      cause?: unknown
    }

    const nestedAggregate =
      Array.isArray(withExtra.errors) && withExtra.errors.length > 0
        ? withExtra.errors
            .slice(0, 3)
            .map((item) => formatError(item))
            .join('; ')
        : undefined

    const nestedCause =
      withExtra.error != null
        ? formatError(withExtra.error)
        : withExtra.cause != null
          ? formatError(withExtra.cause)
          : undefined

    const parts = [
      withExtra.message?.trim(),
      withExtra.description?.trim(),
      nestedAggregate,
      nestedCause && nestedCause !== withExtra.message?.trim() ? `cause=${nestedCause}` : undefined,
      withExtra.code ? `code=${withExtra.code}` : undefined,
      withExtra.errno != null ? `errno=${withExtra.errno}` : undefined,
      withExtra.method ? `method=${withExtra.method}` : undefined,
      withExtra.error_code != null ? `tg=${withExtra.error_code}` : undefined,
      withExtra.address ? `address=${withExtra.address}` : undefined,
      withExtra.port != null ? `port=${withExtra.port}` : undefined,
    ].filter(Boolean)

    if (parts.length > 0) {
      return redactSecrets([...new Set(parts)].join(' | '))
    }

    return error.name || 'Unknown error'
  }

  try {
    return redactSecrets(JSON.stringify(error))
  } catch {
    return redactSecrets(String(error))
  }
}

export const log = {
  debug: (scope: string, message: string, fields?: LogFields) => write('DEBUG', scope, message, fields),
  info: (scope: string, message: string, fields?: LogFields) => write('INFO', scope, message, fields),
  warn: (scope: string, message: string, fields?: LogFields) => write('WARN', scope, message, fields),
  error: (scope: string, message: string, fields?: LogFields) => write('ERROR', scope, message, fields),

  http(method: string, url: string, status: number, durationMs: number, fields?: LogFields): void {
    write('INFO', 'HTTP', `${method} ${url} → ${status} (${durationMs}ms)`, fields)
  },

  bot(message: string, fields?: LogFields): void {
    write('INFO', 'BOT', message, fields)
  },

  db(message: string, fields?: LogFields): void {
    write('INFO', 'DB', message, fields)
  },

  banner(title: string, fields?: LogFields): void {
    if (!shouldLog('INFO')) {
      return
    }

    const bar = paint(ansi.dim, '─'.repeat(48))
    console.log(bar)
    write('INFO', 'APP', title, fields)
    console.log(bar)
  },
}
