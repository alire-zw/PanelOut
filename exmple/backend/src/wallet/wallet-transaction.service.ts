import {
  buildTransactionVersion,
  buildWalletTransactions,
} from './wallet-transaction.builder.js'
import {
  invalidateWalletTransactionsCache,
  readWalletTransactionsCache,
  writeWalletTransactionsCache,
} from './wallet-transaction.cache.js'
import type {
  CachedWalletTransactions,
  WalletTransactionsSyncResult,
} from './wallet-transaction.types.js'

async function refreshWalletTransactionsCache(userId: number): Promise<CachedWalletTransactions> {
  const [items, version] = await Promise.all([
    buildWalletTransactions(userId),
    buildTransactionVersion(userId),
  ])

  const payload: CachedWalletTransactions = {
    version,
    cachedAt: new Date().toISOString(),
    items,
  }

  await writeWalletTransactionsCache(userId, payload)
  return payload
}

export async function getWalletTransactions(userId: number): Promise<CachedWalletTransactions> {
  const cached = await readWalletTransactionsCache(userId)
  if (cached) {
    return cached
  }

  return refreshWalletTransactionsCache(userId)
}

export async function syncWalletTransactions(
  userId: number,
  clientVersion?: string,
): Promise<WalletTransactionsSyncResult> {
  const currentVersion = await buildTransactionVersion(userId)
  const cached = await readWalletTransactionsCache(userId)

  const isUpToDate =
    cached &&
    cached.version === currentVersion &&
    (!clientVersion || clientVersion === currentVersion)

  if (isUpToDate) {
    return {
      changed: false,
      version: cached.version,
      cachedAt: cached.cachedAt,
      items: cached.items,
    }
  }

  const fresh = await refreshWalletTransactionsCache(userId)

  return {
    changed: !clientVersion || clientVersion !== fresh.version,
    version: fresh.version,
    cachedAt: fresh.cachedAt,
    items: fresh.items,
  }
}

export { invalidateWalletTransactionsCache }
