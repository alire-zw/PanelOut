import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import TelegramIcon from './icons/TelegramIcon'
import { useTelegram } from '../hooks/useTelegram'
import { useUser } from '../context/UserContext'
import {
  checkChannelLockMembership,
  fetchChannelLockStatus,
  type ChannelLockItem,
  type ChannelLockSlot,
} from '../lib/channelLockApi'
import { lockAppScroll, unlockAppScroll } from '../lib/scrollLock'
import './ChannelLockGate.css'

type ChannelUiState = 'idle' | 'checking' | 'joined'

const CHANNEL_LOCK_BLURBS: Record<ChannelLockSlot, string> = {
  purchase_report: 'رسید خرید و وضعیت سفارش‌های شما',
  notification: 'اخبار، تخفیف‌ها و پیشنهادهای ویژه',
}

function openExternal(url: string) {
  const tg = window.Telegram?.WebApp
  if (tg?.openTelegramLink && url.includes('t.me/')) {
    tg.openTelegramLink(url)
    return
  }
  if (tg?.openLink) {
    tg.openLink(url)
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}

function statusLabel(state: ChannelUiState): string | null {
  if (state === 'checking') return 'در حال بررسی عضویت…'
  if (state === 'joined') return 'عضویت شما تایید شد'
  return null
}

export function ChannelLockGate() {
  const { pathname } = useLocation()
  const { haptic } = useTelegram()
  const { user, isLoading: userLoading, isAuthenticated } = useUser()

  const [isOpen, setIsOpen] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [shouldRender, setShouldRender] = useState(false)
  const [channels, setChannels] = useState<ChannelLockItem[]>([])
  const [uiState, setUiState] = useState<Partial<Record<ChannelLockSlot, ChannelUiState>>>({})
  const [checkingSlot, setCheckingSlot] = useState<ChannelLockSlot | null>(null)
  const pollRef = useRef<number | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current != null) {
      window.clearInterval(pollRef.current)
      pollRef.current = null
    }
    setCheckingSlot(null)
  }, [])

  const applyStatus = useCallback((items: ChannelLockItem[]) => {
    setChannels(items)
    setUiState((prev) => {
      const next: Partial<Record<ChannelLockSlot, ChannelUiState>> = { ...prev }
      for (const item of items) {
        if (item.joined) next[item.slotKey] = 'joined'
        else if (next[item.slotKey] === 'joined') next[item.slotKey] = 'idle'
      }
      return next
    })
    const required = items.some((item) => !item.joined)
    setIsOpen(required)
    if (!required) stopPolling()
  }, [stopPolling])

  const refreshStatus = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setIsOpen(false)
      setChannels([])
      stopPolling()
      return
    }

    if (user.canAccessAdminPanel || user.role === 'admin' || user.role === 'supervisor') {
      setIsOpen(false)
      setChannels([])
      stopPolling()
      return
    }

    try {
      const status = await fetchChannelLockStatus()
      if (status.bypassed || !status.required) {
        applyStatus(status.channels)
        setIsOpen(false)
        return
      }
      applyStatus(status.channels)
    } catch {
      // Keep previous gate state on transient errors
    }
  }, [applyStatus, isAuthenticated, stopPolling, user])

  useEffect(() => {
    if (pathname === '/login' || userLoading) return
    void refreshStatus()
  }, [pathname, refreshStatus, userLoading])

  useEffect(() => {
    if (pathname === '/login') {
      setIsOpen(false)
      stopPolling()
    }
  }, [pathname, stopPolling])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && isOpen) {
        void refreshStatus()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [isOpen, refreshStatus])

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsVisible(true))
      })
      return
    }

    setIsVisible(false)
    const timer = window.setTimeout(() => setShouldRender(false), 450)
    return () => window.clearTimeout(timer)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      unlockAppScroll()
      return
    }
    lockAppScroll()
    return () => unlockAppScroll()
  }, [isOpen])

  useEffect(() => () => stopPolling(), [stopPolling])

  const startPolling = (slotKey: ChannelLockSlot) => {
    stopPolling()
    setCheckingSlot(slotKey)
    setUiState((prev) => ({ ...prev, [slotKey]: prev[slotKey] === 'joined' ? 'joined' : 'checking' }))

    const tick = async () => {
      try {
        const { channel } = await checkChannelLockMembership(slotKey)
        setChannels((prev) =>
          prev.map((item) => (item.slotKey === slotKey ? channel : item)),
        )
        if (channel.joined) {
          setUiState((prev) => ({ ...prev, [slotKey]: 'joined' }))
          haptic('medium')
          stopPolling()
          void refreshStatus()
        } else {
          setUiState((prev) => ({ ...prev, [slotKey]: 'checking' }))
        }
      } catch {
        setUiState((prev) => ({ ...prev, [slotKey]: 'checking' }))
      }
    }

    void tick()
    pollRef.current = window.setInterval(() => {
      void tick()
    }, 2000)
  }

  const handleChannelClick = (channel: ChannelLockItem) => {
    if (channel.joined || uiState[channel.slotKey] === 'joined') return
    haptic('light')
    openExternal(channel.url)
    startPolling(channel.slotKey)
  }

  if (!shouldRender || pathname === '/login') return null

  return createPortal(
    <>
      <div
        className={`channel-lock__backdrop${isVisible ? ' channel-lock__backdrop--visible' : ''}`}
        role="presentation"
      />
      <div
        className={`channel-lock__panel${isVisible ? ' channel-lock__panel--visible' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="عضویت در کانال"
      >
        <div className="channel-lock__header">
          <div className="channel-lock__handle" aria-hidden="true" />
          <p className="channel-lock__eyebrow">عضویت الزامی</p>
          <h2 className="channel-lock__title">برای ادامه باید در کانال‌های ما عضو شوید</h2>
          <p className="channel-lock__desc">
            لطفاً در این کانال‌ها عضو شوید تا از اخبار، تخفیف‌ها و پشتیبانی ما باخبر بمانید و
            بتوانید از امکانات مینی‌اپ استفاده کنید.
          </p>
        </div>

        <div className="channel-lock__list">
          {channels.map((channel) => {
            const state: ChannelUiState =
              uiState[channel.slotKey] ?? (channel.joined ? 'joined' : 'idle')
            const label = statusLabel(state)
            const isChecking = state === 'checking' || checkingSlot === channel.slotKey
            const isJoined = state === 'joined' || channel.joined

            return (
              <button
                key={channel.slotKey}
                type="button"
                className={`channel-lock__item${isJoined ? ' is-joined' : ''}${isChecking && !isJoined ? ' is-checking' : ''}`}
                onClick={() => handleChannelClick(channel)}
                disabled={isJoined}
              >
                <span className="channel-lock__item-icon">
                  <TelegramIcon width={18} height={18} />
                </span>
                <span className="channel-lock__item-copy">
                  <span className="channel-lock__item-title">{channel.label}</span>
                  <span
                    className={`channel-lock__item-blurb${label ? ' is-status' : ''}${isJoined ? ' is-ok' : ''}`}
                  >
                    {label ?? CHANNEL_LOCK_BLURBS[channel.slotKey]}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </>,
    document.body,
  )
}
