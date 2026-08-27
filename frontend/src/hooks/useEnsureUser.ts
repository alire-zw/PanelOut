import { useEffect } from 'react'
import { useUser } from '../context/UserContext'

/**
 * Ensures current user is loaded/refreshed whenever a main page mounts.
 */
export function useEnsureUser() {
  const userState = useUser()

  useEffect(() => {
    void userState.refetch({ silent: true })
  }, [userState.refetch])

  return userState
}
