import { useCallback, useEffect, useState } from 'react'
import { useEnsureUser } from './useEnsureUser'
import { useTelegram } from './useTelegram'
import {
  fetchMyPanelsCached,
  readLocalMyPanels,
  syncMyPanels,
  writeLocalMyPanels,
  type MyPanelsPayload,
} from '../lib/myPanelsCache'
import type { PanelSubscription } from '../lib/panelApi'
import { isTelegramWebApp } from '../lib/telegram'

type UseMyPanelsOptions = {
  enabled?: boolean
}

export function useMyPanels(options: UseMyPanelsOptions = {}) {
  const { enabled = true } = options
  const { isReady } = useTelegram()
  const { isLoading: isUserLoading, isAuthenticated } = useEnsureUser()

  const [panels, setPanels] = useState<PanelSubscription[]>(
    () => readLocalMyPanels()?.panels ?? [],
  )
  const [userBalance, setUserBalance] = useState(
    () => readLocalMyPanels()?.userBalance ?? 0,
  )
  const [loading, setLoading] = useState(() => !readLocalMyPanels())
  const [error, setError] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)

  const applyPayload = useCallback((payload: MyPanelsPayload) => {
    setPanels(payload.panels)
    setUserBalance(payload.userBalance)
    setError(null)
    writeLocalMyPanels(payload)
  }, [])

  const refreshInBackground = useCallback(
    async (version?: string | null) => {
      setIsSyncing(true)
      try {
        const syncResult = await syncMyPanels(version ?? undefined)
        if (syncResult.changed) {
          applyPayload(syncResult)
        }
      } catch {
        // background sync should not block the UI
      } finally {
        setIsSyncing(false)
      }
    },
    [applyPayload],
  )

  const load = useCallback(async () => {
    const localCache = readLocalMyPanels()
    if (localCache) {
      applyPayload(localCache)
      setLoading(false)
      void refreshInBackground(localCache.version)
      return
    }

    setError(null)

    try {
      const payload = await fetchMyPanelsCached()
      applyPayload(payload)
      void refreshInBackground(payload.version)
    } catch (err) {
      setPanels([])
      setUserBalance(0)
      setError(err instanceof Error ? err.message : 'خطا در دریافت پنل‌ها')
    } finally {
      setLoading(false)
    }
  }, [applyPayload, refreshInBackground])

  const patchPanel = useCallback(
    (subscriptionId: string, patch: Partial<PanelSubscription>) => {
      setPanels((prev) => {
        const next = prev.map((p) =>
          p.id === subscriptionId ? { ...p, ...patch } : p,
        )
        const cached = readLocalMyPanels()
        if (cached) {
          writeLocalMyPanels({ ...cached, panels: next })
        }
        return next
      })
    },
    [],
  )

  const setUserBalanceLocal = useCallback((balance: number) => {
    setUserBalance(balance)
    const cached = readLocalMyPanels()
    if (cached) {
      writeLocalMyPanels({ ...cached, userBalance: balance })
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    if (!isReady || isUserLoading) return

    if (isTelegramWebApp() && !isAuthenticated) {
      setLoading(false)
      setError('احراز هویت تلگرام انجام نشد. مینی‌اپ را ببندید و دوباره باز کنید.')
      return
    }

    void load()
  }, [enabled, isReady, isUserLoading, isAuthenticated, load])

  return {
    panels,
    userBalance,
    loading,
    error,
    isSyncing,
    reload: load,
    patchPanel,
    setUserBalanceLocal,
    applyPayload,
    refreshInBackground,
  }
}
