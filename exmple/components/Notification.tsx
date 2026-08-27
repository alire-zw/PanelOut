import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { isTelegramWebApp } from '../lib/api'
import styles from './Notification.module.css'

export type NotificationType = 'success' | 'error' | 'warning' | 'info'

interface NotificationProps {
  show: boolean
  message: string
  type?: NotificationType
  onClose?: () => void
  duration?: number
}

const TYPE_TITLES: Record<NotificationType, string> = {
  success: 'موفقیت',
  error: 'خطا',
  warning: 'هشدار',
  info: 'اطلاع',
}

const AUTO_DISMISS_MS = 3000
const EXIT_MS = 400

export function Notification({
  show,
  message,
  type = 'success',
  onClose,
  duration = AUTO_DISMISS_MS,
}: NotificationProps) {
  const [hiding, setHiding] = useState(false)
  const hidingRef = useRef(false)
  const onCloseRef = useRef(onClose)
  const inTelegram = isTelegramWebApp()

  onCloseRef.current = onClose

  const handleClose = useCallback(() => {
    if (hidingRef.current) return
    hidingRef.current = true
    setHiding(true)
    window.setTimeout(() => {
      hidingRef.current = false
      setHiding(false)
      onCloseRef.current?.()
    }, EXIT_MS)
  }, [])

  useEffect(() => {
    if (!show) {
      hidingRef.current = false
      setHiding(false)
      return undefined
    }

    if (!onCloseRef.current || duration <= 0) return undefined

    const timer = window.setTimeout(handleClose, duration)
    return () => window.clearTimeout(timer)
  }, [show, message, type, duration, handleClose])

  if (!show) return null

  return createPortal(
    <div
      className={[
        styles.wrapper,
        hiding ? styles.hide : styles.show,
        inTelegram ? styles.telegram : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        className={[styles.notification, styles[type]].join(' ')}
        role="status"
        aria-live="polite"
        onClick={onClose ? handleClose : undefined}
      >
        <div className={styles.glass} aria-hidden="true" />
        <div className={styles.accent} aria-hidden="true" />
        <div className={styles.notificationContent}>
          <div className={styles.notificationTitle}>{TYPE_TITLES[type]}</div>
          <div className={styles.notificationMessage}>{message}</div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
