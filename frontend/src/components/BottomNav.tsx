import { useCallback, useEffect, useMemo, useRef } from 'react'
import { NavLink } from 'react-router-dom'
import { useUser } from '../context/UserContext'
import { useTelegram } from '../hooks/useTelegram'
import {
  readProfileCreditsShown,
  writeProfileCreditsShown,
} from '../lib/profileCredits'
import { adminNavItem, iconSize, navItems } from './navItems'
import './BottomNav.css'

const PROFILE_UNLOCK_TAPS = 3
const PROFILE_UNLOCK_WINDOW_MS = 2500

export function BottomNav() {
  const { haptic } = useTelegram()
  const { user } = useUser()
  const profileTapCountRef = useRef(0)
  const profileTapTimerRef = useRef<number | null>(null)

  const items = useMemo(() => {
    if (!user?.canAccessAdminPanel) return navItems
    const next = [...navItems]
    const profileIndex = next.findIndex((item) => item.id === 'profile')
    if (profileIndex === -1) {
      next.push(adminNavItem)
      return next
    }
    next.splice(profileIndex, 0, adminNavItem)
    return next
  }, [user?.canAccessAdminPanel])

  useEffect(() => {
    return () => {
      if (profileTapTimerRef.current !== null) {
        window.clearTimeout(profileTapTimerRef.current)
      }
    }
  }, [])

  const handleProfileTap = useCallback(() => {
    haptic('light')

    if (readProfileCreditsShown()) return

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

    writeProfileCreditsShown(true)
    haptic('medium')
  }, [haptic])

  return (
    <nav className="bottom-nav" aria-label="ناوبری اصلی">
      <div className="bottom-nav__inner">
        {items.map((item) => {
          const Icon = item.icon
          const ActiveIcon = item.activeIcon
          const isProfile = item.id === 'profile'

          return (
            <NavLink
              key={item.id}
              to={item.path}
              end={item.path === '/' || item.path === '/admin'}
              className={({ isActive }) =>
                `bottom-nav__item${isActive ? ' bottom-nav__item--active' : ''}`
              }
              onClick={isProfile ? handleProfileTap : () => haptic('light')}
            >
              {({ isActive }) => (
                <>
                  <span className="bottom-nav__icon">
                    <span
                      className={`bottom-nav__glyph${isActive ? '' : ' bottom-nav__glyph--visible'}`}
                    >
                      <Icon {...iconSize} />
                    </span>
                    <span
                      className={`bottom-nav__glyph${isActive ? ' bottom-nav__glyph--visible' : ''}`}
                    >
                      <ActiveIcon {...iconSize} />
                    </span>
                  </span>
                  <span className="bottom-nav__label">{item.label}</span>
                </>
              )}
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
