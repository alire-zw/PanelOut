import { useEffect, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { BottomSheet } from '../components/BottomSheet'
import { Notification } from '../components/Notification'
import AdminIcon from '../components/icons/AdminIcon'
import AiAutoRotateIcon from '../components/icons/ai-auto-rotate-stroke-rounded'
import BankCardIcon from '../components/icons/BankCardIcon'
import ColleagueIcon from '../components/icons/ColleagueIcon'
import CollaborationIcon from '../components/icons/CollaborationIcon'
import CopyIcon from '../components/icons/CopyIcon'
import FavouriteIcon from '../components/icons/FavouriteIcon'
import Moon01Icon from '../components/icons/moon-01-stroke-rounded'
import Sun01Icon from '../components/icons/sun-01-stroke-rounded'
import PaymentHistoryIcon from '../components/icons/PaymentHistoryIcon'
import RegularUserIcon from '../components/icons/RegularUserIcon'
import SocialMediaIcon from '../components/icons/SocialMediaIcon'
import TelegramIcon from '../components/icons/TelegramIcon'
import ThemeIcon from '../components/icons/ThemeIcon'
import { defaultAvatar } from '../components/headerConstants'
import { useUser } from '../context/UserContext'
import { useTheme } from '../hooks/useTheme'
import { useTelegram } from '../hooks/useTelegram'
import {
  PROFILE_CREDITS_EVENT,
  readProfileCreditsShown,
} from '../lib/adminUnlock'
import { formatUserDisplayName, isTelegramWebApp } from '../lib/api'
import { isBrowserPublicMode } from '../lib/browserSession'
import type { ThemeMode } from '../lib/theme'
import type { UserRole } from '../types/user'
import '../styles/shop-rise.css'
import './Profile.css'

function ArrowIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="none" viewBox="0 0 24 24">
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="m15 18-6-6 6-6"
      />
    </svg>
  )
}

function AccountInfoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        opacity="0.4"
        d="M16 7C16 9.20914 14.2091 11 12 11C9.79086 11 8 9.20914 8 7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M14 14H10C7.23858 14 5 16.2386 5 19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19C19 16.2386 16.7614 14 14 14Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function getRoleStyles(role: UserRole) {
  switch (role) {
    case 'admin':
      return {
        backgroundColor: 'var(--role-admin-bg)',
        icon: <AdminIcon width={16} height={16} color="var(--role-admin-color)" className="profile__role-icon" />,
      }
    case 'supervisor':
      return {
        backgroundColor: 'var(--role-supervisor-bg)',
        icon: (
          <ColleagueIcon
            width={16}
            height={16}
            color="var(--role-supervisor-color)"
            className="profile__role-icon"
          />
        ),
      }
    default:
      return {
        backgroundColor: 'var(--role-user-bg)',
        icon: (
          <RegularUserIcon
            width={16}
            height={16}
            color="var(--role-user-color)"
            className="profile__role-icon"
          />
        ),
      }
  }
}

export function ProfilePage() {
  const navigate = useNavigate()
  const { user, isLoading, logout } = useUser()
  const { user: telegramUser, haptic } = useTelegram()
  const { themeMode, setTheme } = useTheme()
  const [isThemeSheetOpen, setIsThemeSheetOpen] = useState(false)
  const [isSocialSheetOpen, setIsSocialSheetOpen] = useState(false)
  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  }>({
    show: false,
    message: '',
    type: 'success',
  })
  const [showCredits, setShowCredits] = useState(() => readProfileCreditsShown())

  useEffect(() => {
    const syncCredits = () => setShowCredits(readProfileCreditsShown())
    window.addEventListener(PROFILE_CREDITS_EVENT, syncCredits)
    return () => window.removeEventListener(PROFILE_CREDITS_EVENT, syncCredits)
  }, [])

  const displayName = user ? formatUserDisplayName(user) : 'کاربر'
  const userAvatar = telegramUser?.photoUrl ?? defaultAvatar
  const userId = user?.id?.toString() ?? ''
  const inTelegram = isTelegramWebApp()
  const roleStyles = user ? getRoleStyles(user.role) : null

  useEffect(() => {
    if (inTelegram || isLoading) return
    if (!user && isBrowserPublicMode()) {
      navigate('/login', { replace: true })
    }
  }, [inTelegram, isLoading, navigate, user])

  const copyUserId = async () => {
    if (!userId) return
    try {
      await navigator.clipboard.writeText(userId)
      haptic('light')
      setNotification({ show: true, message: 'کپی شد', type: 'success' })
    } catch {
      setNotification({ show: true, message: 'کپی شناسه ناموفق بود', type: 'error' })
    }
  }

  const handleThemeChange = (mode: ThemeMode) => {
    setTheme(mode)
    haptic('light')
  }

  const handleMenuClick = (action: () => void) => {
    haptic('light')
    action()
  }

  if (isLoading) {
    return (
      <div className="profile" aria-busy="true" aria-label="در حال بارگذاری پروفایل">
        <div className="profile__header shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
          <div className="profile__info">
            <div className="profile__avatar profile__skeleton-block profile__skeleton-avatar" />
            <div className="profile__text">
              <span className="profile__skeleton-block profile__skeleton-name" />
              <span className="profile__skeleton-block profile__skeleton-id" />
            </div>
            <div className="profile__spacer" />
            <span className="profile__skeleton-block profile__skeleton-badge" />
          </div>
        </div>

        <div className="profile__skeleton-title shop-rise" style={{ '--rise-index': 1 } as CSSProperties} />
        <div className="profile__menu-box shop-rise" style={{ '--rise-index': 2 } as CSSProperties}>
          <div className="profile__skeleton-row">
            <span className="profile__skeleton-block profile__skeleton-icon" />
            <span className="profile__skeleton-block profile__skeleton-label" />
          </div>
          <div className="profile__menu-divider" />
          <div className="profile__skeleton-row">
            <span className="profile__skeleton-block profile__skeleton-icon" />
            <span className="profile__skeleton-block profile__skeleton-label profile__skeleton-label--wide" />
          </div>
        </div>

        <div className="profile__skeleton-title shop-rise" style={{ '--rise-index': 3 } as CSSProperties} />
        <div className="profile__menu-box shop-rise" style={{ '--rise-index': 4 } as CSSProperties}>
          <div className="profile__skeleton-row">
            <span className="profile__skeleton-block profile__skeleton-icon" />
            <span className="profile__skeleton-block profile__skeleton-label profile__skeleton-label--lg" />
          </div>
        </div>

        <div className="profile__skeleton-title shop-rise" style={{ '--rise-index': 5 } as CSSProperties} />
        <div className="profile__menu-box shop-rise" style={{ '--rise-index': 6 } as CSSProperties}>
          {[0, 1, 2].map((index) => (
            <div key={index}>
              {index > 0 ? <div className="profile__menu-divider" /> : null}
              <div className="profile__skeleton-row">
                <span className="profile__skeleton-block profile__skeleton-icon" />
                <span
                  className={`profile__skeleton-block profile__skeleton-label${
                    index === 2 ? ' profile__skeleton-label--xl' : ''
                  }`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="profile">
      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification((prev) => ({ ...prev, show: false }))}
      />

      <div
        className="profile__header shop-rise"
        style={{ '--rise-index': 0 } as CSSProperties}
      >
        <div className="profile__info">
          <div className="profile__avatar">
            <img src={userAvatar} alt="" width={56} height={56} />
          </div>
          <div className="profile__text">
            <div className="profile__name">{displayName}</div>
            <div className="profile__user-id">
              شناسه کاربری: <span>{userId || 'ثبت نشده'}</span>
              {userId && (
                <button
                  type="button"
                  className="profile__copy"
                  onClick={copyUserId}
                  title="کپی شناسه"
                  aria-label="کپی شناسه"
                >
                  <CopyIcon width={14} height={14} />
                </button>
              )}
            </div>
          </div>
          <div className="profile__spacer" />
          {roleStyles && (
            <div className="profile__role-badge" style={{ backgroundColor: roleStyles.backgroundColor }}>
              {roleStyles.icon}
            </div>
          )}
        </div>
      </div>

      <h5
        className="profile__menu-title shop-rise"
        style={{ '--rise-index': 1 } as CSSProperties}
      >
        حساب کاربری
      </h5>
      <div
        className="profile__menu-box shop-rise"
        style={{ '--rise-index': 2 } as CSSProperties}
      >
        <button type="button" className="profile__menu-item" onClick={() => handleMenuClick(() => navigate('/profile/info'))}>
          <span className="profile__menu-start">
            <span className="profile__menu-icon">
              <AccountInfoIcon />
            </span>
            <span>اطلاعات حساب</span>
          </span>
          <ArrowIcon />
        </button>
        <div className="profile__menu-divider" />
        <button type="button" className="profile__menu-item" onClick={() => handleMenuClick(() => navigate('/profile/cards'))}>
          <span className="profile__menu-start">
            <span className="profile__menu-icon">
              <BankCardIcon width={18} height={18} />
            </span>
            <span>کارت های بانکی</span>
          </span>
          <ArrowIcon />
        </button>
      </div>

      <h5
        className="profile__menu-title shop-rise"
        style={{ '--rise-index': 3 } as CSSProperties}
      >
        سفارشات و تاریخچه
      </h5>
      <div
        className="profile__menu-box shop-rise"
        style={{ '--rise-index': 4 } as CSSProperties}
      >
        <button
          type="button"
          className="profile__menu-item"
          onClick={() => handleMenuClick(() => navigate('/profile/charge-history'))}
        >
          <span className="profile__menu-start">
            <span className="profile__menu-icon">
              <PaymentHistoryIcon width={18} height={18} />
            </span>
            <span>تاریخچه شارژ حساب</span>
          </span>
          <ArrowIcon />
        </button>
      </div>

      <h5
        className="profile__menu-title shop-rise"
        style={{ '--rise-index': 5 } as CSSProperties}
      >
        سایر
      </h5>
      <div
        className="profile__menu-box shop-rise"
        style={{ '--rise-index': 6 } as CSSProperties}
      >
        <button type="button" className="profile__menu-item" onClick={() => handleMenuClick(() => setIsThemeSheetOpen(true))}>
          <span className="profile__menu-start">
            <span className="profile__menu-icon">
              <ThemeIcon width={18} height={18} />
            </span>
            <span>تم سایت</span>
          </span>
          <ArrowIcon />
        </button>
        <div className="profile__menu-divider" />
        <div className="profile__menu-item profile__menu-item--disabled">
          <span className="profile__menu-start">
            <span className="profile__menu-icon">
              <CollaborationIcon width={18} height={18} />
            </span>
            <span>
              {user?.role === 'supervisor' ? 'شما در حال حاضر همکار هستید' : 'همکاری با ما'}
            </span>
          </span>
          <ArrowIcon />
        </div>
        <div className="profile__menu-divider" />
        <button type="button" className="profile__menu-item" onClick={() => handleMenuClick(() => setIsSocialSheetOpen(true))}>
          <span className="profile__menu-start">
            <span className="profile__menu-icon">
              <SocialMediaIcon width={18} height={18} />
            </span>
            <span>وایرال‌تل در شبکه های اجتماعی</span>
          </span>
          <ArrowIcon />
        </button>
      </div>

      {!inTelegram && (
        <div
          className="profile__logout shop-rise"
          style={{ '--rise-index': 7 } as CSSProperties}
        >
          <div className="profile__menu-box">
            <button
              type="button"
              className="profile__menu-item profile__menu-item--logout"
              onClick={() => {
                haptic('medium')
                logout()
                navigate(isBrowserPublicMode() ? '/login' : '/', { replace: true })
              }}
            >
              <span className="profile__menu-start">
                <span className="profile__menu-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M4.39267 4.00087C4 4.61597 4 5.41166 4 7.00304V16.997C4 18.5883 4 19.384 4.39267 19.9991C4.46279 20.109 4.5414 20.2132 4.62777 20.3108C5.11144 20.8572 5.87666 21.0758 7.4071 21.513C8.9414 21.9513 9.70856 22.1704 10.264 21.8417C10.3604 21.7847 10.45 21.7171 10.5313 21.6402C11 21.1965 11 2.80351 10.5313 2.35982C10.45 2.28288 10.3604 2.21527 10.264 2.15827C9.70856 1.82956 8.9414 2.0487 7.4071 2.48699C5.87666 2.92418 5.11144 3.14278 4.62777 3.68925C4.5414 3.78684 4.46279 3.89103 4.39267 4.00087Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      opacity="0.4"
                      d="M11 4H13.0171C14.9188 4 15.8696 4 16.4604 4.58579C16.7898 4.91238 16.9355 5.34994 17 6M11 20H13.0171C14.9188 20 15.8696 20 16.4604 19.4142C16.7898 19.0876 16.9355 18.6501 17 18"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M21 12H14M19.5 9.49994C19.5 9.49994 22 11.3412 22 12C22 12.6588 19.5 14.4999 19.5 14.4999"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span>خروج از حساب کاربری</span>
              </span>
            </button>
          </div>
        </div>
      )}

      {showCredits && !user?.canAccessAdminPanel && (
        <p
          className="profile__credits shop-rise"
          style={{ '--rise-index': 8 } as CSSProperties}
        >
          <span>ساخته شده با</span>
          <span className="profile__credits-heart" aria-hidden>
            <FavouriteIcon width={14} height={14} />
          </span>
          <span>توسط</span>
          <a
            className="profile__credits-link"
            href="https://t.me/alire_zw"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => haptic('light')}
          >
            علیرضا میرحسینی
          </a>
        </p>
      )}

      <BottomSheet
        isOpen={isThemeSheetOpen}
        onClose={() => setIsThemeSheetOpen(false)}
        title="انتخاب تم"
        options={[
          { value: 'auto', label: 'خودکار', icon: <AiAutoRotateIcon width={18} height={18} /> },
          { value: 'light', label: 'روشن', icon: <Sun01Icon width={18} height={18} /> },
          { value: 'dark', label: 'تیره', icon: <Moon01Icon width={18} height={18} /> },
        ]}
        selectedValue={themeMode}
        onSelect={(value) => handleThemeChange(value as ThemeMode)}
      />

      <BottomSheet
        isOpen={isSocialSheetOpen}
        onClose={() => setIsSocialSheetOpen(false)}
        title="وایرال‌تل در شبکه های اجتماعی"
        options={[
          {
            value: 'channel',
            label: 'کانال تلگرام وایرال‌تل',
            icon: <TelegramIcon width={18} height={18} color="#0088cc" />,
          },
          {
            value: 'bot',
            label: 'ربات تلگرام وایرال‌تل',
            icon: <TelegramIcon width={18} height={18} color="#0088cc" />,
          },
        ]}
        selectedValue={['channel', 'bot']}
        onSelect={(value) => {
          haptic('light')
          if (value === 'channel') {
            window.open('https://t.me/ViralTelShop', '_blank', 'noopener,noreferrer')
          } else if (value === 'bot') {
            window.open('https://t.me/viraltelbot', '_blank', 'noopener,noreferrer')
          }
        }}
      />
    </div>
  )
}
