import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { fetchCurrentUser, updateCurrentUser, type UpdateCurrentUserPayload } from '../lib/userApi'
import { isTelegramWebApp } from '../lib/api'
import type { AppUser } from '../types/user'

type RefetchOptions = {
  silent?: boolean
}

type UserContextValue = {
  user: AppUser | null
  isLoading: boolean
  isAuthenticated: boolean
  error: string | null
  refetch: (options?: RefetchOptions) => Promise<AppUser | null>
  updateProfile: (payload: UpdateCurrentUserPayload) => Promise<AppUser>
}

const UserContext = createContext<UserContextValue | null>(null)

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async (options?: RefetchOptions) => {
    const silent = Boolean(options?.silent)

    if (!isTelegramWebApp()) {
      setUser(null)
      setError(null)
      setIsLoading(false)
      return null
    }

    if (!silent) setIsLoading(true)

    try {
      const next = await fetchCurrentUser()
      setUser(next)
      setError(null)
      return next
    } catch (err) {
      const message = err instanceof Error ? err.message : 'خطا در دریافت اطلاعات کاربر'
      setError(message)
      if (!silent) setUser(null)
      return null
    } finally {
      if (!silent) setIsLoading(false)
    }
  }, [])

  const updateProfile = useCallback(async (payload: UpdateCurrentUserPayload) => {
    if (!isTelegramWebApp()) {
      throw new Error('فقط داخل تلگرام قابل ویرایش است')
    }

    const next = await updateCurrentUser(payload)
    setUser(next)
    setError(null)
    return next
  }, [])

  useEffect(() => {
    let cancelled = false

    const boot = async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
      if (cancelled) return
      await refetch()
    }

    void boot()
    return () => {
      cancelled = true
    }
  }, [refetch])

  const value = useMemo<UserContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      error,
      refetch,
      updateProfile,
    }),
    [user, isLoading, error, refetch, updateProfile],
  )

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

export function useUser() {
  const ctx = useContext(UserContext)
  if (!ctx) {
    throw new Error('useUser must be used within UserProvider')
  }
  return ctx
}
