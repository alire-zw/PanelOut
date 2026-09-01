import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import ComplaintIcon from './icons/complaint-stroke-rounded'
import DoNotTouch01Icon from './icons/do-not-touch-01-stroke-rounded'
import OctagonXIcon from './icons/octagon-x-stroke-rounded'
import { useTelegram } from '../hooks/useTelegram'
import { useUser } from '../context/UserContext'
import {
  fetchSupportContact,
  readLocalSupportContact,
  writeLocalSupportContact,
} from '../lib/supportApi'
import { isTelegramWebApp } from '../lib/telegram'
import { lockAppScroll, unlockAppScroll } from '../lib/scrollLock'
import './BannedGate.css'

function ChevronIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden
    >
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

export function BannedGate() {
  const { haptic } = useTelegram()
  const { user, isLoading: userLoading, refetch } = useUser()
  const [isVisible, setIsVisible] = useState(false)
  const [shouldRender, setShouldRender] = useState(false)
  const [telegramUsername, setTelegramUsername] = useState<string | null>(
    () => readLocalSupportContact()?.telegramUsername ?? null,
  )
  const [telegramUrl, setTelegramUrl] = useState<string | null>(
    () => readLocalSupportContact()?.telegramUrl ?? null,
  )

  const isBanned = Boolean(user?.isBanned)

  useEffect(() => {
    if (!isBanned) return

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void refetch({ silent: true })
      }
    }

    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [isBanned, refetch])

  useEffect(() => {
    if (!isBanned) return

    const local = readLocalSupportContact()
    if (local) {
      setTelegramUsername(local.telegramUsername)
      setTelegramUrl(local.telegramUrl)
    }

    void fetchSupportContact()
      .then((contact) => {
        setTelegramUsername(contact.telegramUsername)
        setTelegramUrl(contact.telegramUrl)
        writeLocalSupportContact(contact)
      })
      .catch(() => {})
  }, [isBanned])

  useEffect(() => {
    if (userLoading) return

    if (isBanned) {
      setShouldRender(true)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsVisible(true))
      })
      return
    }

    setIsVisible(false)
    const timer = window.setTimeout(() => setShouldRender(false), 480)
    return () => window.clearTimeout(timer)
  }, [isBanned, userLoading])

  useEffect(() => {
    if (!isBanned) {
      unlockAppScroll()
      return
    }
    lockAppScroll()
    return () => unlockAppScroll()
  }, [isBanned])

  const openSupportChat = () => {
    if (!telegramUrl) return
    haptic('medium')
    if (isTelegramWebApp() && window.Telegram?.WebApp.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(telegramUrl)
      return
    }
    window.open(telegramUrl, '_blank', 'noopener,noreferrer')
  }

  if (!shouldRender) return null

  return createPortal(
    <>
      <div
        className={`ban-gate__backdrop${isVisible ? ' ban-gate__backdrop--visible' : ''}`}
        role="presentation"
      />

      <div
        className={`ban-gate__panel${isVisible ? ' ban-gate__panel--visible' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="ban-gate-heading"
        aria-describedby="ban-gate-message"
      >
        <div className="ban-gate__header">
          <div className="ban-gate__handle" aria-hidden="true" />
          <p className="ban-gate__sheet-title">مسدودیت حساب</p>
        </div>

        <div className="ban-gate__content">
          <section className="ban-gate__hero" aria-labelledby="ban-gate-heading">
            <div className="ban-gate__hero-icon" aria-hidden="true">
              <OctagonXIcon width={26} height={26} color="currentColor" />
              <span className="ban-gate__hero-icon-badge">
                <DoNotTouch01Icon width={14} height={14} color="currentColor" />
              </span>
            </div>

            <div className="ban-gate__hero-copy">
              <h2 id="ban-gate-heading" className="ban-gate__hero-title">
                دسترسی شما به پنلوت محدود شده است
              </h2>
              <p id="ban-gate-message" className="ban-gate__hero-desc">
                حساب کاربری شما توسط تیم پشتیبانی مسدود شده و تا زمان بررسی، امکان
                استفاده از مینی‌اپ، کیف پول و سرویس‌های پنل در دسترس نیست.
              </p>
            </div>
          </section>

          <div className="ban-gate__notice">
            <p className="ban-gate__notice-text">
              اگر فکر می‌کنید این محدودیت به‌اشتباه اعمال شده، می‌توانید از طریق
              پشتیبانی درخواست بررسی ثبت کنید.
            </p>
          </div>

          <button
            type="button"
            className={`ban-gate__support${telegramUsername ? '' : ' ban-gate__support--disabled'}`}
            disabled={!telegramUsername}
            onClick={openSupportChat}
          >
            <span className="ban-gate__support-icon">
              <ComplaintIcon width={18} height={18} color="currentColor" />
            </span>
            <span className="ban-gate__support-copy">
              <span className="ban-gate__support-label">ارتباط با پشتیبانی</span>
              <span className="ban-gate__support-hint">
                {telegramUsername
                  ? 'در تلگرام با کارشناس گفتگو کنید'
                  : 'در حال آماده‌سازی لینک پشتیبانی…'}
              </span>
            </span>
            <span className="ban-gate__support-chevron">
              <ChevronIcon />
            </span>
          </button>
        </div>
      </div>
    </>,
    document.body,
  )
}
