import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../context/UserContext'

export function useAdminAccess() {
  const navigate = useNavigate()
  const { user, isLoading, isAuthenticated } = useUser()
  const allowed = Boolean(user?.canAccessAdminPanel)

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated || !allowed) {
      navigate('/profile', { replace: true })
    }
  }, [allowed, isAuthenticated, isLoading, navigate])

  return {
    ready: !isLoading && isAuthenticated && allowed,
    allowed,
    user,
  }
}
