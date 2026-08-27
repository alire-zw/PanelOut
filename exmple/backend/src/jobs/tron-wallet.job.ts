import { env } from '../config/env.js'
import { log } from '../lib/logger.js'
import { processWalletBalances } from '../crypto-payments/crypto-payment.service.js'
import { expireAllStalePayments } from '../payments/payment.service.js'
import { ensureMissingUserWallets } from '../tron/wallet.service.js'

let intervalHandle: ReturnType<typeof setInterval> | null = null
let isRunning = false

async function runWalletJob(): Promise<void> {
  if (isRunning) {
    return
  }

  isRunning = true
  try {
    await expireAllStalePayments()
    await processWalletBalances()
  } catch (error) {
    log.error('CRON', 'tron wallet job failed', {
      error: error instanceof Error ? error.message : 'unknown',
    })
  } finally {
    isRunning = false
  }
}

export function startTronWalletJob(): void {
  if (intervalHandle) {
    return
  }

  void ensureMissingUserWallets().then((count) => {
    if (count > 0) {
      log.info('CRON', 'backfilled tron wallets', { count })
    }
  })

  void expireAllStalePayments()
  void runWalletJob()

  intervalHandle = setInterval(() => {
    void runWalletJob()
  }, env.TRON_CRON_INTERVAL_MS)

  log.info('CRON', 'tron wallet job started', { intervalMs: env.TRON_CRON_INTERVAL_MS })
}

export function stopTronWalletJob(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle)
    intervalHandle = null
  }
}
