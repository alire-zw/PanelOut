import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmojiGlyph } from '../components/EmojiGlyph'
import { EmptyState } from '../components/EmptyState'
import { Notification } from '../components/Notification'
import { PageHeader } from '../components/PageHeader'
import Delete02Icon from '../components/icons/delete-02-stroke-rounded'
import EditIcon from '../components/icons/EditIcon'
import Link01Icon from '../components/icons/link-01-stroke-rounded'
import LockIcon from '../components/icons/LockIcon'
import TrashIcon from '../components/icons/TrashIcon'
import { useUser } from '../context/UserContext'
import { REACTION_SINGLE_EMOJIS } from '../data/reactionEmojis'
import { useTelegram } from '../hooks/useTelegram'
import { isTelegramWebApp } from '../lib/api'
import {
  readLocalAutoChannels,
  writeLocalAutoChannels,
} from '../lib/autoChannelsCache'
import { formatTomanPrice } from '../lib/formatStars'
import {
  configureAutoReactionChannel,
  deactivateAutoReactionChannel,
  deleteAutoReactionChannel,
  fetchAutoReactionBotInfo,
  fetchAutoReactionChannels,
  registerAutoReactionChannel,
  type AutoReactionChannel,
} from '../lib/reaction'
import { usePricedToman } from '../hooks/useShopPricing'
import { calcReactionTotalToman } from '../types/reaction'
import '../styles/shop-rise.css'
import './Reaction.css'
import './ReactionAuto.css'

const heroConfig = {
  stillSrc: '/shop-heroes/reaction/megaphone-still.webp',
  animatedSrc: '/shop-heroes/reaction/megaphone.webp',
}

type ViewMode = 'list' | 'add' | 'configure'

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

export function ReactionAutoPage() {
  const navigate = useNavigate()
  const { haptic, user: tgUser } = useTelegram()
  const { user } = useUser()
  const cacheUserKey = String(user?.id ?? tgUser?.id ?? 'anon')

  const [view, setView] = useState<ViewMode>('list')
  const [channels, setChannels] = useState<AutoReactionChannel[]>([])
  const [botUsername, setBotUsername] = useState('...')
  const [botDeepLink, setBotDeepLink] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [cacheReady, setCacheReady] = useState(false)
  const [postLink, setPostLink] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [registerError, setRegisterError] = useState<string | null>(null)
  const [selectedChannel, setSelectedChannel] = useState<AutoReactionChannel | null>(null)
  const [selectedCounts, setSelectedCounts] = useState<Record<number, number>>({})
  const [randomizeQuantity, setRandomizeQuantity] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [animatedReady, setAnimatedReady] = useState(false)
  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  }>({ show: false, message: '', type: 'error' })

  const longPressTimerRef = useRef<number | null>(null)
  const suppressClickRef = useRef(false)
  const activePointerIdRef = useRef<number | null>(null)
  const animatedRef = useRef<HTMLImageElement>(null)

  const handleBack = useCallback(() => {
    if (view === 'configure' || view === 'add') {
      setView('list')
      setSelectedChannel(null)
      setPostLink('')
      setRegisterError(null)
      setSelectedCounts({})
      setRandomizeQuantity(false)
      return
    }
    navigate('/reaction', { replace: true })
  }, [navigate, view])

  const showNotification = (
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'error',
  ) => {
    setNotification({ show: true, message, type })
  }

  useEffect(() => {
    let cancelled = false
    const cached = readLocalAutoChannels<AutoReactionChannel>('reaction', cacheUserKey)
    if (cached) {
      setChannels(cached.channels)
      setBotUsername(cached.botUsername || '...')
      setBotDeepLink(cached.botDeepLink)
      setIsLoading(false)
      setCacheReady(true)
    } else {
      setIsLoading(true)
    }

    const boot = async () => {
      try {
        const [bot, channelResponse] = await Promise.all([
          fetchAutoReactionBotInfo(),
          fetchAutoReactionChannels(),
        ])
        if (cancelled) return
        setBotUsername(bot.username)
        setBotDeepLink(bot.deepLink)
        setChannels(channelResponse.channels)
        writeLocalAutoChannels('reaction', cacheUserKey, {
          channels: channelResponse.channels,
          botUsername: bot.username,
          botDeepLink: bot.deepLink,
          cachedAt: new Date().toISOString(),
        })
        setCacheReady(true)
      } catch (error) {
        if (!cancelled && !cached) {
          showNotification(
            error instanceof Error ? error.message : 'خطا در بارگذاری',
            'error',
          )
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void boot()
    return () => {
      cancelled = true
    }
  }, [cacheUserKey])

  useEffect(() => {
    if (!cacheReady) return
    writeLocalAutoChannels('reaction', cacheUserKey, {
      channels,
      botUsername,
      botDeepLink,
      cachedAt: new Date().toISOString(),
    })
  }, [botDeepLink, botUsername, cacheReady, cacheUserKey, channels])

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

  useEffect(() => {
    const img = animatedRef.current
    if (img?.complete && img.naturalWidth > 0) {
      setAnimatedReady(true)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current != null) {
        window.clearTimeout(longPressTimerRef.current)
      }
    }
  }, [])

  const headerTitle =
    view === 'add' ? 'افزودن کانال' : view === 'configure' ? 'تنظیم ری‌اکشن' : 'ری‌اکشن خودکار'

  const heroDescription =
    'کانال خود را ثبت کنید و ری‌اکشن‌های موردنظر را یک‌بار تنظیم نمایید. از آن پس، برای هر پست جدید به‌صورت خودکار سفارش ثبت و هزینه از کیف پول کسر می‌شود.'

  const selectedReactions = useMemo(() => {
    return REACTION_SINGLE_EMOJIS.filter((option) => (selectedCounts[option.serviceId] ?? 0) > 0).map(
      (option) => ({
        serviceId: option.serviceId,
        emoji: option.emoji,
        quantity: selectedCounts[option.serviceId] ?? 0,
        rate: option.rate,
        min: option.min,
        max: option.max,
      }),
    )
  }, [selectedCounts])

  const baseToman = useMemo(
    () => calcReactionTotalToman(selectedReactions),
    [selectedReactions],
  )
  const { toman: totalToman } = usePricedToman('reaction', baseToman)

  const canSave = selectedReactions.length > 0 && !isSaving

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current != null) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  const decreaseEmoji = (serviceId: number, min: number) => {
    suppressClickRef.current = true
    haptic('medium')
    setSelectedCounts((prev) => {
      const current = prev[serviceId] ?? 0
      if (current <= 0) return prev
      if (current <= min) {
        const next = { ...prev }
        delete next[serviceId]
        return next
      }
      return { ...prev, [serviceId]: current - 1 }
    })
  }

  const increaseEmoji = (serviceId: number, min: number, max: number) => {
    haptic('light')
    setSelectedCounts((prev) => {
      const current = prev[serviceId] ?? 0
      if (current >= max) return prev
      if (current <= 0) return { ...prev, [serviceId]: min }
      return { ...prev, [serviceId]: current + 1 }
    })
  }

  const handleEmojiPointerDown = (
    event: PointerEvent<HTMLButtonElement>,
    serviceId: number,
    min: number,
  ) => {
    if (event.button !== 0) return
    activePointerIdRef.current = event.pointerId
    suppressClickRef.current = false
    clearLongPressTimer()
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // ignore
    }
    longPressTimerRef.current = window.setTimeout(() => {
      decreaseEmoji(serviceId, min)
    }, 420)
  }

  const handleEmojiPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    if (activePointerIdRef.current !== event.pointerId) return
    clearLongPressTimer()
    activePointerIdRef.current = null
  }

  const handleEmojiPointerCancel = (event: PointerEvent<HTMLButtonElement>) => {
    if (activePointerIdRef.current !== event.pointerId) return
    clearLongPressTimer()
    activePointerIdRef.current = null
  }

  const handleEmojiClick = (serviceId: number, min: number, max: number) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    increaseEmoji(serviceId, min, max)
  }

  const openConfigure = (channel: AutoReactionChannel) => {
    haptic('light')
    setSelectedChannel(channel)
    const counts: Record<number, number> = {}
    for (const item of channel.reactions) {
      counts[item.serviceId] = item.quantity
    }
    setSelectedCounts(counts)
    setRandomizeQuantity(Boolean(channel.randomizeQuantity))
    setView('configure')
  }

  const handleRegister = async () => {
    if (isRegistering) return
    const link = postLink.trim()
    if (!looksLikeTelegramPostLink(link)) {
      setRegisterError('لطفاً لینک معتبر یکی از پست‌های عمومی کانال را وارد کنید')
      return
    }

    haptic('light')
    setIsRegistering(true)
    setRegisterError(null)

    try {
      const response = await registerAutoReactionChannel(link)
      setChannels((prev) => {
        const without = prev.filter((item) => item.id !== response.channel.id)
        return [response.channel, ...without]
      })
      showNotification('کانال با موفقیت ثبت شد', 'success')
      openConfigure(response.channel)
      setPostLink('')
    } catch (error) {
      setRegisterError(error instanceof Error ? error.message : 'ثبت کانال ناموفق بود')
    } finally {
      setIsRegistering(false)
    }
  }

  const handleSaveConfig = async () => {
    if (!selectedChannel || !canSave) return
    haptic('light')
    setIsSaving(true)

    try {
      const response = await configureAutoReactionChannel(
        selectedChannel.id,
        selectedReactions.map((item) => ({
          serviceId: item.serviceId,
          emoji: item.emoji,
          quantity: item.quantity,
          rate: item.rate,
        })),
        randomizeQuantity,
      )
      setChannels((prev) =>
        prev.map((item) => (item.id === response.channel.id ? response.channel : item)),
      )
      showNotification('ری‌اکشن خودکار فعال شد', 'success')
      setView('list')
      setSelectedChannel(null)
      setSelectedCounts({})
      setRandomizeQuantity(false)
    } catch (error) {
      showNotification(error instanceof Error ? error.message : 'ذخیره ناموفق بود', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeactivate = async (channel: AutoReactionChannel) => {
    haptic('light')
    try {
      const response = await deactivateAutoReactionChannel(channel.id)
      setChannels((prev) =>
        prev.map((item) => (item.id === response.channel.id ? response.channel : item)),
      )
      showNotification('ری‌اکشن خودکار غیرفعال شد', 'info')
    } catch (error) {
      showNotification(error instanceof Error ? error.message : 'عملیات ناموفق بود', 'error')
    }
  }

  const handleDelete = async (channel: AutoReactionChannel) => {
    haptic('medium')
    try {
      await deleteAutoReactionChannel(channel.id)
      setChannels((prev) => prev.filter((item) => item.id !== channel.id))
      if (selectedChannel?.id === channel.id) {
        setView('list')
        setSelectedChannel(null)
      }
      showNotification('کانال حذف شد', 'success')
    } catch (error) {
      showNotification(error instanceof Error ? error.message : 'حذف ناموفق بود', 'error')
    }
  }

  return (
    <div className="reaction reaction-auto">
      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification((prev) => ({ ...prev, show: false }))}
      />

      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title={headerTitle} onBack={handleBack} />
      </div>

      <div className="reaction__body">
        {view === 'list' ? (
          <section
            className="reaction__hero shop-rise"
            style={{ '--rise-index': 1 } as CSSProperties}
            aria-label="ری‌اکشن خودکار"
          >
            <div className="reaction__image-wrap" aria-hidden>
              <div className="reaction__image-glow" />
              <img
                src={heroConfig.stillSrc}
                alt=""
                className={`reaction__image reaction__image--still${
                  animatedReady ? ' reaction__image--hidden' : ''
                }`}
                width={90}
                height={90}
                fetchPriority="high"
                decoding="async"
              />
              <img
                ref={animatedRef}
                src={heroConfig.animatedSrc}
                alt=""
                className={`reaction__image reaction__image--animated${
                  animatedReady ? ' reaction__image--visible' : ''
                }`}
                width={90}
                height={90}
                decoding="async"
                onLoad={() => setAnimatedReady(true)}
              />
            </div>

            <p className="reaction__desc">{heroDescription}</p>
          </section>
        ) : null}

        {view === 'list' ? (
          <>
            {isLoading && channels.length === 0 ? (
              <>
                <div
                  className="reaction__section-head shop-rise"
                  style={{ '--rise-index': 2 } as CSSProperties}
                >
                  <h2 className="reaction__section-title">کانال‌های شما</h2>
                </div>
                <section
                  className="reaction-auto__list shop-rise"
                  style={{ '--rise-index': 3 } as CSSProperties}
                  aria-busy="true"
                  aria-label="در حال بارگذاری کانال‌ها"
                >
                  {[0, 1, 2].map((index) => (
                    <div
                      key={index}
                      className="reaction-auto__row reaction-auto__row--skeleton"
                    >
                      <div className="reaction-auto__row-main">
                        <span className="reaction-auto__skel reaction-auto__skel-title" />
                        <span className="reaction-auto__skel reaction-auto__skel-meta" />
                      </div>
                      <div className="reaction-auto__row-actions">
                        <span className="reaction-auto__skel reaction-auto__skel-btn" />
                        <span className="reaction-auto__skel reaction-auto__skel-btn" />
                      </div>
                    </div>
                  ))}
                </section>
              </>
            ) : channels.length === 0 ? (
              <EmptyState
                className="shop-rise"
                style={{ '--rise-index': 2 } as CSSProperties}
                title="کانالی ثبت نشده است"
                description="ابتدا ربات را به‌عنوان ادمین کانال اضافه کنید؛ سپس با وارد کردن لینک یکی از پست‌های عمومی کانال، آن را ثبت نمایید."
              />
            ) : (
              <>
                <div
                  className="reaction__section-head shop-rise"
                  style={{ '--rise-index': 2 } as CSSProperties}
                >
                  <h2 className="reaction__section-title">کانال‌های شما</h2>
                </div>
                <section
                  className="reaction-auto__list shop-rise"
                  style={{ '--rise-index': 3 } as CSSProperties}
                  aria-label="کانال‌های ثبت‌شده"
                >
                  {channels.map((channel) => (
                    <article
                      key={channel.id}
                      className={`reaction-auto__row${channel.isActive ? '' : ' is-off'}`}
                    >
                      <button
                        type="button"
                        className="reaction-auto__row-main"
                        onClick={() => openConfigure(channel)}
                      >
                        <span className="reaction-auto__row-avatar" aria-hidden>
                          {channel.photoUrl ? (
                            <img
                              src={channel.photoUrl}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            channel.title.charAt(0)
                          )}
                        </span>
                        <span className="reaction-auto__row-body">
                          <span className="reaction-auto__row-title-line">
                            <strong className="reaction-auto__row-title">{channel.title}</strong>
                            <span
                              className={`reaction-auto__badge${
                                channel.isActive ? ' reaction-auto__badge--on' : ''
                              }`}
                            >
                              {channel.isActive ? 'فعال' : 'غیرفعال'}
                            </span>
                          </span>
                          <span className="reaction-auto__row-meta">
                            <span className="reaction-auto__row-username">@{channel.username}</span>
                            {channel.reactions.length > 0 ? (
                              <span className="reaction-auto__row-emojis" aria-hidden>
                                {channel.reactions.slice(0, 4).map((item) => (
                                  <span key={item.serviceId} className="reaction-auto__row-emoji">
                                    <EmojiGlyph emoji={item.emoji} size={12} />
                                  </span>
                                ))}
                                {channel.reactions.length > 4 ? (
                                  <span className="reaction-auto__row-emoji-more">
                                    +{(channel.reactions.length - 4).toLocaleString('fa-IR')}
                                  </span>
                                ) : null}
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </button>

                      <div className="reaction-auto__row-actions">
                        <button
                          type="button"
                          className="reaction-auto__icon-btn"
                          aria-label="تنظیم کانال"
                          onClick={() => openConfigure(channel)}
                        >
                          <EditIcon width={15} height={15} />
                        </button>
                        {channel.isActive ? (
                          <button
                            type="button"
                            className="reaction-auto__icon-btn is-pause"
                            aria-label="توقف ری‌اکشن خودکار"
                            onClick={() => void handleDeactivate(channel)}
                          >
                            <LockIcon width={15} height={15} locked />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="reaction-auto__icon-btn is-danger"
                          aria-label="حذف کانال"
                          onClick={() => void handleDelete(channel)}
                        >
                          <TrashIcon width={15} height={15} />
                        </button>
                      </div>
                    </article>
                  ))}
                </section>
              </>
            )}
          </>
        ) : null}

        {view === 'add' ? (
          <>
            <section
              className="reaction-auto__steps shop-rise"
              style={{ '--rise-index': 2 } as CSSProperties}
            >
              <div className="reaction-auto__step">
                <span className="reaction-auto__step-num">۱</span>
                <div className="reaction-auto__step-body">
                  <strong>افزودن ربات به‌عنوان ادمین</strong>
                  <p>
                    ربات @{botUsername} را در کانال خود ادمین کنید تا بتواند پست‌های جدید را
                    دریافت و پردازش کند.
                  </p>
                  <button
                    type="button"
                    className="reaction-auto__link-btn"
                    onClick={() => {
                      haptic('light')
                      openExternal(botDeepLink || `https://t.me/${botUsername}`)
                    }}
                  >
                    افزودن ربات به کانال
                  </button>
                </div>
              </div>

              <div className="reaction-auto__step">
                <span className="reaction-auto__step-num">۲</span>
                <div className="reaction-auto__step-body">
                  <strong>وارد کردن لینک پست کانال</strong>
                  <p>
                    لینک یکی از پست‌های عمومی کانال را وارد کنید تا کانال شناسایی و ثبت شود.
                  </p>
                </div>
              </div>
            </section>

            <section
              className="reaction__post-link shop-rise"
              style={{ '--rise-index': 3 } as CSSProperties}
            >
              <div className="reaction__section-head">
                <h2 className="reaction__section-title">لینک پست کانال</h2>
              </div>
              <div
                className={`reaction__field${registerError ? ' reaction__field--error' : ''}`}
              >
                {postLink ? (
                  <button
                    type="button"
                    className="reaction__clear-btn"
                    onClick={() => {
                      haptic('light')
                      setPostLink('')
                      setRegisterError(null)
                    }}
                    aria-label="پاک کردن"
                  >
                    <Delete02Icon width={16} height={16} />
                  </button>
                ) : null}
                <span className="reaction__field-icon" aria-hidden>
                  {isRegistering ? (
                    <span className="reaction__spinner" />
                  ) : (
                    <Link01Icon width={18} height={18} />
                  )}
                </span>
                <input
                  type="url"
                  className="reaction__field-input"
                  value={postLink}
                  onChange={(e) => {
                    setPostLink(e.target.value)
                    setRegisterError(null)
                  }}
                  placeholder="لینک پست را وارد کنید..."
                  dir="ltr"
                  autoComplete="off"
                  spellCheck={false}
                  inputMode="url"
                  aria-label="لینک پست کانال"
                />
              </div>
              {registerError ? (
                <p className="reaction__field-error" role="alert">
                  {registerError}
                </p>
              ) : null}
            </section>
          </>
        ) : null}

        {view === 'configure' && selectedChannel ? (
          <>
            <section
              className="reaction-auto__selected shop-rise"
              style={{ '--rise-index': 1 } as CSSProperties}
            >
              <span className="reaction-auto__row-avatar" aria-hidden>
                {selectedChannel.photoUrl ? (
                  <img
                    src={selectedChannel.photoUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  selectedChannel.title.charAt(0)
                )}
              </span>
              <div className="reaction-auto__row-body">
                <strong className="reaction-auto__row-title">{selectedChannel.title}</strong>
                <span className="reaction-auto__row-username" dir="ltr">
                  @{selectedChannel.username}
                </span>
              </div>
            </section>

            <section
              className="reaction__emojis shop-rise"
              style={{ '--rise-index': 2 } as CSSProperties}
              aria-label="انتخاب ری‌اکشن"
            >
              <div className="reaction__section-head">
                <h2 className="reaction__section-title">ری‌اکشن پست‌های جدید</h2>
                <span className="reaction__section-hint">
                  برای افزایش، کلیک کنید و برای کاهش، انگشت خود را نگه دارید
                </span>
              </div>

              <div className="reaction__emoji-grid" role="list">
                {REACTION_SINGLE_EMOJIS.map((option) => {
                  const count = selectedCounts[option.serviceId] ?? 0
                  const isSelected = count > 0

                  return (
                    <button
                      key={option.serviceId}
                      type="button"
                      role="listitem"
                      className={`reaction__emoji-btn${
                        isSelected ? ' reaction__emoji-btn--selected' : ''
                      }`}
                      onClick={() => handleEmojiClick(option.serviceId, option.min, option.max)}
                      onPointerDown={(event) =>
                        handleEmojiPointerDown(event, option.serviceId, option.min)
                      }
                      onPointerUp={handleEmojiPointerUp}
                      onPointerCancel={handleEmojiPointerCancel}
                      onContextMenu={(event) => event.preventDefault()}
                      aria-label={`${option.emoji}${isSelected ? `، ${count}` : ''}`}
                    >
                      <span className="reaction__emoji-glyph" aria-hidden>
                        <EmojiGlyph emoji={option.emoji} size={18} />
                      </span>
                      {isSelected ? (
                        <span className="reaction__emoji-count">
                          {count.toLocaleString('fa-IR')}
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </section>

            <label
              className="reaction-auto__random shop-rise"
              style={{ '--rise-index': 3 } as CSSProperties}
            >
              <input
                type="checkbox"
                className="reaction-auto__random-input"
                checked={randomizeQuantity}
                onChange={(event) => {
                  haptic('light')
                  setRandomizeQuantity(event.target.checked)
                }}
              />
              <span className="reaction-auto__random-content">
                <span className="reaction-auto__random-title">تغییر اعداد به‌صورت تصادفی</span>
                <span className="reaction-auto__random-desc">
                  با فعال‌سازی این گزینه، تعداد هر ری‌اکشن در هر پست جدید به‌صورت تصادفی بین ۱ تا ۵
                  واحد بیشتر یا کمتر از مقدار انتخابی شما تنظیم می‌شود تا طبیعی‌تر به نظر برسد.
                </span>
              </span>
            </label>

            {selectedReactions.length > 0 ? (
              <section
                className="reaction-auto__summary shop-rise"
                style={{ '--rise-index': 4 } as CSSProperties}
              >
                <span>هزینه تقریبی هر پست جدید</span>
                <strong>
                  {formatTomanPrice(totalToman)} <span>تومان</span>
                </strong>
              </section>
            ) : null}
          </>
        ) : null}
      </div>

      <footer
        className="reaction__footer shop-rise"
        style={{ '--rise-index': 5 } as CSSProperties}
      >
        {view === 'list' ? (
          <button
            type="button"
            className="reaction__continue"
            onClick={() => {
              haptic('light')
              setView('add')
              setPostLink('')
              setRegisterError(null)
            }}
          >
            افزودن کانال
          </button>
        ) : null}

        {view === 'add' ? (
          <button
            type="button"
            className="reaction__continue"
            disabled={isRegistering || !postLink.trim()}
            onClick={() => void handleRegister()}
          >
            {isRegistering ? 'در حال بررسی...' : 'ثبت کانال'}
          </button>
        ) : null}

        {view === 'configure' ? (
          <button
            type="button"
            className="reaction__continue"
            disabled={!canSave}
            onClick={() => void handleSaveConfig()}
          >
            {isSaving ? 'در حال ذخیره...' : 'فعال‌سازی ری‌اکشن خودکار'}
          </button>
        ) : null}
      </footer>
    </div>
  )
}
