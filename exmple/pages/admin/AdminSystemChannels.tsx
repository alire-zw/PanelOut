import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import EditIcon from '../../components/icons/EditIcon'
import LockIcon from '../../components/icons/LockIcon'
import TrashIcon from '../../components/icons/TrashIcon'
import { useAdminAccess } from '../../hooks/useAdminAccess'
import { useTelegram } from '../../hooks/useTelegram'
import {
  deleteAdminSystemChannel,
  fetchAdminSystemChannels,
  fetchAdminSystemChannelsBot,
  registerAdminSystemChannel,
  setAdminSystemChannelActive,
  type AdminSystemChannelSlot,
  type AdminSystemChannelSlotItem,
} from '../../lib/adminApi'
import { isTelegramWebApp } from '../../lib/api'
import { AdminScreen } from './AdminScreen'

type ViewMode = 'list' | 'add'

function looksLikeTelegramPostLink(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false

  const normalized = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed.replace(/^\/+/, '')}`

  try {
    const url = new URL(normalized)
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    if (host !== 't.me' && host !== 'telegram.me' && host !== 'telegram.dog') {
      return false
    }

    const parts = url.pathname.split('/').filter(Boolean)
    if (parts[0]?.toLowerCase() === 'c') return false
    const usernameIndex = parts[0]?.toLowerCase() === 's' ? 1 : 0
    const username = parts[usernameIndex]
    const messageId = Number.parseInt(parts[usernameIndex + 1] ?? '', 10)
    return Boolean(username) && Number.isFinite(messageId) && messageId > 0
  } catch {
    return false
  }
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

export function AdminSystemChannelsPage() {
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const { ready, allowed } = useAdminAccess()

  const [view, setView] = useState<ViewMode>('list')
  const [items, setItems] = useState<AdminSystemChannelSlotItem[]>([])
  const [loading, setLoading] = useState(true)
  const [botUsername, setBotUsername] = useState('...')
  const [botDeepLink, setBotDeepLink] = useState('')
  const [selectedSlot, setSelectedSlot] = useState<AdminSystemChannelSlotItem | null>(null)
  const [postLink, setPostLink] = useState('')
  const [registerError, setRegisterError] = useState<string | null>(null)
  const [isRegistering, setIsRegistering] = useState(false)
  const [busySlot, setBusySlot] = useState<AdminSystemChannelSlot | null>(null)
  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  }>({ show: false, message: '', type: 'error' })

  const handleBack = useCallback(() => {
    if (view === 'add') {
      setView('list')
      setSelectedSlot(null)
      setPostLink('')
      setRegisterError(null)
      return
    }
    navigate('/admin', { replace: true })
  }, [navigate, view])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [bot, channels] = await Promise.all([
        fetchAdminSystemChannelsBot(),
        fetchAdminSystemChannels(),
      ])
      setBotUsername(bot.username)
      setBotDeepLink(bot.deepLink)
      setItems(channels.items)
    } catch (error) {
      setNotification({
        show: true,
        message: error instanceof Error ? error.message : 'خطا در دریافت کانال‌ها',
        type: 'error',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!ready || !allowed) return
    void load()
  }, [allowed, load, ready])

  useEffect(() => {
    if (!isTelegramWebApp()) return
    const backButton = window.Telegram?.WebApp.BackButton
    if (!backButton) return
    backButton.show()
    backButton.onClick(handleBack)
    return () => {
      backButton.hide()
      backButton.offClick(handleBack)
    }
  }, [handleBack])

  const openAdd = (slot: AdminSystemChannelSlotItem) => {
    haptic('light')
    setSelectedSlot(slot)
    setPostLink('')
    setRegisterError(null)
    setView('add')
  }

  const handleRegister = async () => {
    if (!selectedSlot || isRegistering) return
    const link = postLink.trim()
    if (!looksLikeTelegramPostLink(link)) {
      setRegisterError('لطفاً لینک معتبر یکی از پست‌های عمومی کانال را وارد کنید')
      return
    }

    haptic('light')
    setIsRegistering(true)
    setRegisterError(null)

    try {
      await registerAdminSystemChannel(selectedSlot.slotKey, link)
      await load()
      haptic('medium')
      setNotification({
        show: true,
        message: `«${selectedSlot.label}» ثبت شد`,
        type: 'success',
      })
      setView('list')
      setSelectedSlot(null)
      setPostLink('')
    } catch (error) {
      setRegisterError(error instanceof Error ? error.message : 'ثبت کانال ناموفق بود')
    } finally {
      setIsRegistering(false)
    }
  }

  const handleToggleActive = async (slot: AdminSystemChannelSlotItem) => {
    if (!slot.channel || busySlot) return
    const next = !slot.channel.isActive
    haptic('light')
    setBusySlot(slot.slotKey)
    try {
      await setAdminSystemChannelActive(slot.slotKey, next)
      await load()
      setNotification({
        show: true,
        message: next ? 'کانال قفل شد' : 'قفل کانال برداشته شد',
        type: next ? 'info' : 'success',
      })
    } catch (error) {
      setNotification({
        show: true,
        message: error instanceof Error ? error.message : 'عملیات ناموفق بود',
        type: 'error',
      })
    } finally {
      setBusySlot(null)
    }
  }

  const handleDelete = async (slot: AdminSystemChannelSlotItem) => {
    if (!slot.channel || busySlot) return
    if (!window.confirm(`کانال «${slot.label}» حذف شود؟`)) return
    haptic('medium')
    setBusySlot(slot.slotKey)
    try {
      await deleteAdminSystemChannel(slot.slotKey)
      await load()
      setNotification({ show: true, message: 'کانال حذف شد', type: 'success' })
    } catch (error) {
      setNotification({
        show: true,
        message: error instanceof Error ? error.message : 'حذف ناموفق بود',
        type: 'error',
      })
    } finally {
      setBusySlot(null)
    }
  }

  if (!ready || !allowed) return null

  return (
    <AdminScreen
      sticky={view === 'list'}
      title={view === 'add' && selectedSlot ? selectedSlot.label : 'کانال‌های سیستم'}
      eyebrow="اطلاع‌رسانی"
      onBack={handleBack}
      notification={notification}
      onCloseNotification={() => setNotification((prev) => ({ ...prev, show: false }))}
    >
      {view === 'list' ? (
        <>
          <p className="admin-sys-ch__intro">
            کانال گزارش ادمین همیشه فعال است و فقط برای ادمین. دو کانال دیگر را می‌توانید برای عضویت
            اجباری کاربران قفل کنید؛ ربات را ادمین کانال کنید و لینک یک پست عمومی را بفرستید.
          </p>
          {loading ? (
            <p className="admin__muted">در حال بارگذاری…</p>
          ) : (
            <div className="admin-sys-ch__list shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
              {items.map((slot) => {
                const channel = slot.channel
                const busy = busySlot === slot.slotKey
                const isAdminReport = slot.slotKey === 'admin_report'
                return (
                  <article
                    key={slot.slotKey}
                    className={`admin-sys-ch__row${
                      channel && !channel.isActive && !isAdminReport ? ' is-locked' : ''
                    }`}
                  >
                    <div className="admin-sys-ch__row-main">
                      <strong className="admin-sys-ch__row-title">{slot.label}</strong>
                      {channel ? (
                        isAdminReport ? (
                          <span className="admin-sys-ch__row-meta">
                            فقط ادمین · <span dir="ltr">@{channel.username}</span>
                          </span>
                        ) : (
                          <span className="admin-sys-ch__row-meta admin-sys-ch__row-meta--id">
                            @{channel.username}
                          </span>
                        )
                      ) : (
                        <span className="admin-sys-ch__row-meta">
                          {isAdminReport ? 'فقط ادمین · ثبت نشده' : 'ثبت نشده'}
                        </span>
                      )}
                    </div>

                    {channel ? (
                      <div className="admin-sys-ch__row-actions">
                        {!isAdminReport ? (
                          <button
                            type="button"
                            className={`admin-icon-btn${channel.isActive ? ' is-on' : ' is-off'}`}
                            disabled={busy}
                            aria-label={channel.isActive ? 'برداشتن قفل کانال' : 'قفل کردن کانال'}
                            onClick={() => void handleToggleActive(slot)}
                          >
                            <LockIcon width={15} height={15} locked={channel.isActive} />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="admin-icon-btn"
                          disabled={busy}
                          aria-label="تعویض کانال"
                          onClick={() => openAdd(slot)}
                        >
                          <EditIcon width={15} height={15} />
                        </button>
                        <button
                          type="button"
                          className="admin-icon-btn is-danger"
                          disabled={busy}
                          aria-label="حذف کانال"
                          onClick={() => void handleDelete(slot)}
                        >
                          <TrashIcon width={15} height={15} />
                        </button>
                      </div>
                    ) : (
                      <div className="admin-sys-ch__row-actions">
                        <button
                          type="button"
                          className="admin-sys-ch__add-btn"
                          onClick={() => openAdd(slot)}
                        >
                          افزودن
                        </button>
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </>
      ) : selectedSlot ? (
        <section className="admin-sys-ch__add shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
          <div className="admin-sys-ch__steps">
            <p>
              ۱. ربات <strong dir="ltr">@{botUsername}</strong> را به‌عنوان ادمین کانال اضافه کنید.
            </p>
            <button
              type="button"
              className="admin__btn admin__btn--ghost"
              disabled={!botDeepLink}
              onClick={() => {
                if (!botDeepLink) return
                haptic('light')
                openExternal(botDeepLink)
              }}
            >
              افزودن ربات به کانال
            </button>
            <p>۲. لینک یکی از پست‌های عمومی همان کانال را وارد کنید.</p>
          </div>

          <label className="admin-price__field">
            <span className="admin-price__field-label">لینک پست کانال</span>
            <div className="admin-price__field-row">
              <input
                className="admin-price__input"
                value={postLink}
                onChange={(event) => {
                  setPostLink(event.target.value)
                  setRegisterError(null)
                }}
                placeholder="https://t.me/channel/123"
                dir="ltr"
                inputMode="url"
              />
            </div>
            {registerError ? <span className="admin-sys-ch__error">{registerError}</span> : null}
          </label>

          <button
            type="button"
            className="admin__btn"
            disabled={isRegistering || !postLink.trim()}
            onClick={() => void handleRegister()}
          >
            {isRegistering ? 'در حال ثبت…' : 'ثبت کانال'}
          </button>
        </section>
      ) : null}
      <div style={{ height: 20 }} />
    </AdminScreen>
  )
}
