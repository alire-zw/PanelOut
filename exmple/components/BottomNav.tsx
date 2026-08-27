import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useUser } from '../context/UserContext'
import { useTelegram } from '../hooks/useTelegram'
import {
  readAdminNavUnlocked,
  readProfileCreditsShown,
  writeAdminNavUnlocked,
  writeProfileCreditsShown,
} from '../lib/adminUnlock'
import { adminNavItem, iconSize, navItems } from './navItems'
import './BottomNav.css'

const PROFILE_UNLOCK_TAPS = 5
const PROFILE_UNLOCK_WINDOW_MS = 2500

export function BottomNav() {
  const { haptic } = useTelegram()
  const { user } = useUser()
  const [adminUnlocked, setAdminUnlocked] = useState(() => readAdminNavUnlocked())
  const [creditsShown, setCreditsShown] = useState(() => readProfileCreditsShown())
  const profileTapCountRef = useRef(0)
  const profileTapTimerRef = useRef<number | null>(null)

  const canAccessAdminPanel = Boolean(user?.canAccessAdminPanel)

  useEffect(() => {
    if (!canAccessAdminPanel) {
      setAdminUnlocked(false)
      writeAdminNavUnlocked(false)
      return
    }

    setAdminUnlocked(readAdminNavUnlocked())
  }, [canAccessAdminPanel])

  useEffect(() => {
    return () => {
      if (profileTapTimerRef.current !== null) {
        window.clearTimeout(profileTapTimerRef.current)
      }
    }
  }, [])

  const handleProfileTap = useCallback(() => {
    haptic('light')

    const adminReady = canAccessAdminPanel && !adminUnlocked
    const creditsReady = !canAccessAdminPanel && !creditsShown
    if (!adminReady && !creditsReady) return

    profileTapCountRef.current += 1

    if (profileTapTimerRef.current !== null) {
      window.clearTimeout(profileTapTimerRef.current)
    }

    profileTapTimerRef.current = window.setTimeout(() => {
      profileTapCountRef.current = 0
      profileTapTimerRef.current = null
    }, PROFILE_UNLOCK_WINDOW_MS)

    if (profileTapCountRef.current < PROFILE_UNLOCK_TAPS) return

    profileTapCountRef.current = 0
    if (profileTapTimerRef.current !== null) {
      window.clearTimeout(profileTapTimerRef.current)
      profileTapTimerRef.current = null
    }

    if (adminReady) {
      writeAdminNavUnlocked(true)
      setAdminUnlocked(true)
      haptic('medium')
      return
    }

    writeProfileCreditsShown(true)
    setCreditsShown(true)
    haptic('medium')
  }, [adminUnlocked, canAccessAdminPanel, creditsShown, haptic])

  const visibleItems = useMemo(() => {
    if (!canAccessAdminPanel || !adminUnlocked) return navItems

    const profileIndex = navItems.findIndex((item) => item.id === 'profile')
    if (profileIndex < 0) return [...navItems, adminNavItem]

    return [
      ...navItems.slice(0, profileIndex),
      adminNavItem,
      ...navItems.slice(profileIndex),
    ]
  }, [adminUnlocked, canAccessAdminPanel])

  return (
    <nav className="bottom-nav" aria-label="ناوبری اصلی">
      <div className="bottom-nav__inner">
        {visibleItems.map((item) => {
          const Icon = item.icon
          const ActiveIcon = item.activeIcon
          const isProfile = item.id === 'profile'

          return (
            <NavLink
              key={item.id}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `bottom-nav__item${isActive ? ' bottom-nav__item--active' : ''}`
              }
              onClick={isProfile ? handleProfileTap : () => haptic('light')}
            >
              {({ isActive }) => {
                const NavIcon = isActive ? ActiveIcon : Icon

                return (
                  <>
                    <span className="bottom-nav__icon">
                      <NavIcon {...iconSize} />
                    </span>
                    <span className="bottom-nav__label">{item.label}</span>
                  </>
                )
              }}
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
