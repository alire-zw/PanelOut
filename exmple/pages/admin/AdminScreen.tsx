import { useEffect, type ReactNode } from 'react'
import { Notification } from '../../components/Notification'
import ArrowBackIcon from '../../components/icons/ArrowBackIcon'
import { useTelegram } from '../../hooks/useTelegram'
import { isTelegramWebApp } from '../../lib/api'
import '../../styles/shop-rise.css'
import '../Admin.css'

type AdminScreenNotification = {
  show: boolean
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
}

type AdminScreenProps = {
  title: string
  eyebrow?: string
  meta?: ReactNode
  onBack: () => void
  children: ReactNode
  /** Sticky header (+ optional top toolbar); children scroll underneath */
  sticky?: boolean
  /** Renders under the header inside the sticky top block (search/filters) */
  top?: ReactNode
  notification?: AdminScreenNotification
  onCloseNotification?: () => void
}

export function AdminScreen({
  title,
  eyebrow = 'پنل ادمین',
  meta,
  onBack,
  children,
  sticky = false,
  top,
  notification,
  onCloseNotification,
}: AdminScreenProps) {
  const { haptic } = useTelegram()

  useEffect(() => {
    if (!isTelegramWebApp()) return
    const backButton = window.Telegram?.WebApp.BackButton
    if (!backButton) return
    backButton.show()
    backButton.onClick(onBack)
    return () => {
      backButton.hide()
      backButton.offClick(onBack)
    }
  }, [onBack])

  const handleBack = () => {
    haptic('light')
    onBack()
  }

  const header = (
    <header className="admin-screen__header">
      <button
        type="button"
        className="admin-screen__back"
        onClick={handleBack}
        aria-label="بازگشت"
      >
        <ArrowBackIcon width={20} height={20} />
      </button>
      <div className="admin-screen__titles">
        <p className="admin-screen__eyebrow">{eyebrow}</p>
        <h1 className="admin-screen__title">{title}</h1>
      </div>
      {meta != null ? (
        <div className="admin-screen__meta">{meta}</div>
      ) : (
        <div className="admin-screen__meta-spacer" />
      )}
    </header>
  )

  return (
    <div
      className={`admin admin-hub admin-screen${sticky ? ' admin-screen--sticky' : ' admin-page'}`}
    >
      <div className="admin-hub__glow" aria-hidden="true" />

      {notification && (
        <Notification
          show={notification.show}
          message={notification.message}
          type={notification.type}
          onClose={() => onCloseNotification?.()}
        />
      )}

      {sticky ? (
        <>
          <div className="admin-screen__top">
            {header}
            {top}
          </div>
          <div className="admin-screen__scroll">{children}</div>
        </>
      ) : (
        <>
          {header}
          {top}
          <div className="admin-screen__body">{children}</div>
        </>
      )}
    </div>
  )
}
