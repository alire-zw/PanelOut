import { Link, useLocation, useNavigate } from 'react-router-dom'
import MoneyBagIcon from './icons/MoneyBagIcon'
import { useUser } from '../context/UserContext'
import { balanceToToman, formatUserDisplayName, isTelegramWebApp } from '../lib/api'
import { isBrowserPublicMode } from '../lib/browserSession'
import { useTelegram } from '../hooks/useTelegram'
import { defaultAvatar, HEADER_BOX_SIZE } from './headerConstants'
import { shopHeroNavPaths } from '../data/shopHeroPages'
import './Header.css'

const hiddenPaths = [
  '/login',
  '/profile',
  '/wallet',
  '/stars',
  '/premium',
  '/orders',
  '/my-virtual-numbers',
  '/admin',
  ...shopHeroNavPaths,
]

export function Header() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, isAuthenticated } = useUser()
  const { user: telegramUser, haptic } = useTelegram()

  const userName = user ? formatUserDisplayName(user) : 'کاربر'
  const userAvatar = telegramUser?.photoUrl ?? defaultAvatar
  const walletBalance = user ? balanceToToman(user.balance) : null
  const loginPath =
    isBrowserPublicMode() && !isTelegramWebApp() ? '/login' : '/profile'

  const hideHeader =
    hiddenPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`)) ||
    pathname.startsWith('/support/')

  if (hideHeader) {
    return null
  }

  const handleProfileClick = () => {
    haptic('light')
    navigate('/profile')
  }

  const handleWalletClick = () => {
    haptic('light')
    navigate('/wallet')
  }

  return (
    <header className="app-header">
      <nav className="app-header__nav">
        <div className="app-header__row">
          {isAuthenticated ? (
            <div className="app-header__user">
              <button
                type="button"
                onClick={handleProfileClick}
                className="app-header__box app-header__avatar-btn"
                style={{ width: HEADER_BOX_SIZE, height: HEADER_BOX_SIZE }}
                aria-label="پروفایل"
              >
                <img src={userAvatar} alt="" className="app-header__avatar" />
              </button>
              <div className="app-header__user-text">
                <span className="app-header__greeting">سلام ، خوش اومدی</span>
                <span className="app-header__username">{userName}</span>
              </div>
            </div>
          ) : (
            <Link
              to={loginPath}
              className="app-header__login-btn"
              style={{ height: HEADER_BOX_SIZE }}
              onClick={() => haptic('light')}
            >
              ورود
            </Link>
          )}

          <div className="app-header__actions">
            {isAuthenticated && walletBalance !== null && (
              <button
                type="button"
                onClick={handleWalletClick}
                className={`app-header__wallet${
                  walletBalance === 0 ? ' app-header__wallet--empty' : ''
                }`}
                style={{ height: HEADER_BOX_SIZE }}
                aria-label="موجودی"
              >
                <MoneyBagIcon
                  width={16}
                  height={16}
                  color={walletBalance === 0 ? '#ffffff' : 'var(--accent)'}
                />
                {walletBalance > 0 ? (
                  <span className="app-header__wallet-balance">
                    <span className="app-header__wallet-amount">
                      {walletBalance.toLocaleString('fa-IR')}
                    </span>
                    <span className="app-header__wallet-unit">تومان</span>
                  </span>
                ) : (
                  <span className="app-header__wallet-text">شارژ کیف پول</span>
                )}
              </button>
            )}
          </div>
        </div>
      </nav>
    </header>
  )
}
