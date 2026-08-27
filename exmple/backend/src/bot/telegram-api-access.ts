import { spawn, type ChildProcess } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { env } from '../config/env.js'
import { log } from '../lib/logger.js'

const DEFAULT_TELEGRAM_API_ROOT = 'https://api.telegram.org'
const LOCAL_PROXY_PORT = 8787
const LOCAL_PROXY_ROOT = `http://127.0.0.1:${LOCAL_PROXY_PORT}`

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const proxyScript = path.join(backendRoot, 'scripts', 'telegram-api-proxy.ps1')

let proxyProcess: ChildProcess | null = null
let resolvedApiRoot = env.TELEGRAM_API_ROOT

export function getTelegramApiRoot(): string {
  return resolvedApiRoot
}

export function isLocalTelegramProxyActive(): boolean {
  return (
    resolvedApiRoot.startsWith('http://127.0.0.1:') ||
    resolvedApiRoot.startsWith('http://localhost:')
  )
}

async function ensureLocalProxyRunning(): Promise<boolean> {
  if (process.platform !== 'win32') {
    return false
  }

  if (await waitForLocalProxy(400)) {
    return true
  }

  startLocalProxyProcess()
  return waitForLocalProxy()
}

/**
 * Fetch Telegram web pages (t.me embeds / channel pages).
 * When the local WinHTTP proxy is active, route through it.
 */
export async function telegramWebFetch(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const target = new URL(url)
  const host = target.hostname.toLowerCase().replace(/^www\./, '')
  const allowedHosts = new Set(['t.me', 'telegram.me', 'telegram.dog'])

  if (!allowedHosts.has(host)) {
    return fetch(url, init)
  }

  if (!isLocalTelegramProxyActive()) {
    return fetch(url, init)
  }

  const ready = await ensureLocalProxyRunning()
  if (!ready) {
    return fetch(url, init)
  }

  const proxiedUrl = `${LOCAL_PROXY_ROOT}/__tgweb${target.pathname}${target.search}`
  const headers = new Headers(init?.headers)
  headers.set('X-Telegram-Web-Host', host)

  return fetch(proxiedUrl, {
    ...init,
    headers,
  })
}

async function canReachTelegramDirect(): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 4000)
  try {
    const response = await fetch(`${DEFAULT_TELEGRAM_API_ROOT}/`, {
      method: 'GET',
      signal: controller.signal,
    })
    return response.ok || response.status < 500
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

async function waitForLocalProxy(timeoutMs = 12_000): Promise<boolean> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${LOCAL_PROXY_ROOT}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(1500),
      })
      if (response.ok) {
        return true
      }
    } catch {
      // keep waiting
    }
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  return false
}

function startLocalProxyProcess(): void {
  if (proxyProcess || process.platform !== 'win32') {
    return
  }

  log.info('WEBHOOK', 'starting local WinHTTP Telegram API proxy', {
    port: LOCAL_PROXY_PORT,
  })

  const child = spawn(
    'powershell.exe',
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      proxyScript,
      '-Port',
      String(LOCAL_PROXY_PORT),
    ],
    {
      cwd: backendRoot,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  proxyProcess = child

  child.stdout?.on('data', (chunk: Buffer) => {
    const line = chunk
      .toString('utf8')
      .trim()
      .replace(/\/bot\d+:[A-Za-z0-9_-]+/g, '/bot<redacted>')
    if (line) {
      log.debug('TGPROXY', line)
    }
  })

  child.stderr?.on('data', (chunk: Buffer) => {
    const line = chunk
      .toString('utf8')
      .trim()
      .replace(/\/bot\d+:[A-Za-z0-9_-]+/g, '/bot<redacted>')
    if (line) {
      log.warn('TGPROXY', line)
    }
  })

  child.on('exit', (code, signal) => {
    log.warn('TGPROXY', 'local proxy exited', {
      code: code ?? undefined,
      signal: signal ?? undefined,
    })
    proxyProcess = null
  })
}

/**
 * Prefer direct api.telegram.org. On Windows, if Node cannot reach it
 * (common DNS sinkhole / DPI), fall back to a local .NET reverse proxy
 * that can still talk to Telegram — same path that manual PowerShell uses.
 */
export async function resolveTelegramApiRoot(): Promise<string> {
  if (env.TELEGRAM_API_ROOT !== DEFAULT_TELEGRAM_API_ROOT) {
    resolvedApiRoot = env.TELEGRAM_API_ROOT.replace(/\/$/, '')
    log.info('WEBHOOK', 'using configured TELEGRAM_API_ROOT', { api: resolvedApiRoot })
    return resolvedApiRoot
  }

  if (await canReachTelegramDirect()) {
    resolvedApiRoot = DEFAULT_TELEGRAM_API_ROOT
    log.info('WEBHOOK', 'direct Telegram API reachable')
    return resolvedApiRoot
  }

  log.warn('WEBHOOK', 'direct Telegram API unreachable from Node; using local WinHTTP proxy')

  if (process.platform !== 'win32') {
    resolvedApiRoot = DEFAULT_TELEGRAM_API_ROOT
    return resolvedApiRoot
  }

  // Always (re)start so script updates are picked up after tsx watch reloads.
  stopTelegramApiProxy()
  await new Promise((resolve) => setTimeout(resolve, 400))
  startLocalProxyProcess()

  const ready = await waitForLocalProxy()
  if (!ready) {
    log.error('WEBHOOK', 'local Telegram API proxy failed to start')
    resolvedApiRoot = DEFAULT_TELEGRAM_API_ROOT
    return resolvedApiRoot
  }

  resolvedApiRoot = LOCAL_PROXY_ROOT
  log.info('WEBHOOK', 'local Telegram API proxy ready', { api: resolvedApiRoot })
  return resolvedApiRoot
}

export function stopTelegramApiProxy(): void {
  if (proxyProcess) {
    try {
      proxyProcess.kill()
    } catch {
      // ignore
    }
    proxyProcess = null
  }

  if (process.platform === 'win32') {
    try {
      spawn(
        'powershell.exe',
        [
          '-NoProfile',
          '-Command',
          `Get-NetTCPConnection -LocalPort ${LOCAL_PROXY_PORT} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }`,
        ],
        { windowsHide: true, stdio: 'ignore' },
      )
    } catch {
      // ignore
    }
  }
}
