import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { Notification } from '../components/Notification'
import { PageHeader } from '../components/PageHeader'
import Delete02Icon from '../components/icons/delete-02-stroke-rounded'
import EditIcon from '../components/icons/EditIcon'
import Link01Icon from '../components/icons/link-01-stroke-rounded'
import LockIcon from '../components/icons/LockIcon'
import TrashIcon from '../components/icons/TrashIcon'
import ViewIcon from '../components/icons/ViewIcon'
import { useUser } from '../context/UserContext'
import { CHANNEL_VIEW_SERVICE } from '../data/channelViews'
import { shopHeroPages } from '../data/shopHeroPages'
import { useTelegram } from '../hooks/useTelegram'
import { isTelegramWebApp } from '../lib/api'
import {
  readLocalAutoChannels,
  writeLocalAutoChannels,
} from '../lib/autoChannelsCache'
import {
  configureAutoChannelViewChannel,
  deactivateAutoChannelViewChannel,
  deleteAutoChannelViewChannel,
  fetchAutoChannelViewChannels,
  fetchAutoChannelViewsBotInfo,
  registerAutoChannelViewChannel,
  type AutoChannelViewChannel,
} from '../lib/channelViews'
import { usePricedToman } from '../hooks/useShopPricing'
import { calcChannelViewsToman } from '../types/channelViews'
import '../styles/shop-rise.css'
import './ChannelViews.css'
import './ChannelViewsAuto.css'

const heroConfig = shopHeroPages['channel-views']
const QUANTITY_DEBOUNCE_MS = 1500

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

export function ChannelViewsAutoPage() {
  const navigate = useNavigate()
  const { haptic, user: tgUser } = useTelegram()
  const { user } = useUser()
  const cacheUserKey = String(user?.id ?? tgUser?.id ?? 'anon')

  const [view, setView] = useState<ViewMode>('list')
  const [channels, setChannels] = useState<AutoChannelViewChannel[]>([])
  const [botUsername, setBotUsername] = useState('...')
  const [botDeepLink, setBotDeepLink] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [cacheReady, setCacheReady] = useState(false)
  const [postLink, setPostLink] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [registerError, setRegisterError] = useState<string | null>(null)
  const [selectedChannel, setSelectedChannel] = useState<AutoChannelViewChannel | null>(null)
  const [quantityInput, setQuantityInput] = useState('')
  const [committedQuantity, setCommittedQuantity] = useState<number | null>(null)
  const [quantityError, setQuantityError] = useState<string | null>(null)
  const [randomizeQuantity, setRandomizeQuantity] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [animatedReady, setAnimatedReady] = useState(false)
  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  }>({ show: false, message: '', type: 'error' })

  const animatedRef = useRef<HTMLImageElement>(null)

  const handleBack = useCallback(() => {
    if (view === 'configure' || view === 'add') {
      setView('list')
      setSelectedChannel(null)
      setPostLink('')
      setRegisterError(null)
      setQuantityInput('')
      setCommittedQuantity(null)
      setQuantityError(null)
      setRandomizeQuantity(false)
      return
    }
    navigate('/channel-views', { replace: true })
  }, [navigate, view])

  const showNotification = (
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'error',
  ) => {
    setNotification({ show: true, message, type })
  }

  useEffect(() => {
    let cancelled = false
    const cached = readLocalAutoChannels<AutoChannelViewChannel>(
      'channel-views',
      cacheUserKey,
    )
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
          fetchAutoChannelViewsBotInfo(),
          fetchAutoChannelViewChannels(),
        ])
        if (cancelled) return
        setBotUsername(bot.username)
        setBotDeepLink(bot.deepLink)
        setChannels(channelResponse.channels)
        writeLocalAutoChannels('channel-views', cacheUserKey, {
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
    writeLocalAutoChannels('channel-views', cacheUserKey, {
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
    if (view !== 'configure') return

    if (!quantityInput.trim()) {
      setCommittedQuantity(null)
      setQuantityError(null)
      return
    }

    const timer = window.setTimeout(() => {
      const numValue = Number.parseInt(quantityInput, 10)
      if (!Number.isFinite(numValue)) {
        setCommittedQuantity(null)
        setQuantityError(null)
        return
      }

      if (numValue < CHANNEL_VIEW_SERVICE.min) {
        setCommittedQuantity(null)
        setQuantityError(
          `حداقل تعداد بازدید ${CHANNEL_VIEW_SERVICE.min.toLocaleString('fa-IR')} است`,
        )
        return
      }

      if (numValue > CHANNEL_VIEW_SERVICE.max) {
        setCommittedQuantity(null)
        setQuantityError(
          `حداکثر تعداد بازدید ${CHANNEL_VIEW_SERVICE.max.toLocaleString('fa-IR')} است`,
        )
        return
      }

      setQuantityError(null)
      setCommittedQuantity(numValue)
      haptic('light')
    }, QUANTITY_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [haptic, quantityInput, view])

  const headerTitle =
    view === 'add' ? 'افزودن کانال' : view === 'configure' ? 'تنظیم سین' : 'سین خودکار'

  const heroDescription =
    'کانال خود را ثبت کنید و تعداد بازدید را یک‌بار تنظیم نمایید. از آن پس، برای هر پست جدید به‌صورت خودکار سفارش ثبت و هزینه از کیف پول کسر می‌شود.'

  const quantity = committedQuantity ?? 0
  const baseToman = useMemo(
    () => calcChannelViewsToman(quantity, CHANNEL_VIEW_SERVICE.rate),
    [quantity],
  )
  const { toman: totalToman } = usePricedToman('channel-views', baseToman)
  const quantityConfirmed = committedQuantity != null
  const canSave = quantityConfirmed && !isSaving

  const openConfigure = (channel: AutoChannelViewChannel) => {
    haptic('light')
    setSelectedChannel(channel)
    if (channel.quantity > 0) {
      setQuantityInput(String(channel.quantity))
      setCommittedQuantity(channel.quantity)
    } else {
      setQuantityInput('')
      setCommittedQuantity(null)
    }
    setQuantityError(null)
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
      const response = await registerAutoChannelViewChannel(link)
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
    if (!selectedChannel || !canSave || committedQuantity == null) return
    haptic('light')
    setIsSaving(true)

    try {
      const response = await configureAutoChannelViewChannel(selectedChannel.id, {
        serviceId: CHANNEL_VIEW_SERVICE.serviceId,
        quantity: committedQuantity,
        rate: CHANNEL_VIEW_SERVICE.rate,
        randomizeQuantity,
      })
      setChannels((prev) =>
        prev.map((item) => (item.id === response.channel.id ? response.channel : item)),
      )
      showNotification('سین خودکار فعال شد', 'success')
      setView('list')
      setSelectedChannel(null)
      setQuantityInput('')
      setCommittedQuantity(null)
      setRandomizeQuantity(false)
    } catch (error) {
      showNotification(error instanceof Error ? error.message : 'ذخیره ناموفق بود', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeactivate = async (channel: AutoChannelViewChannel) => {
    haptic('light')
    try {
      const response = await deactivateAutoChannelViewChannel(channel.id)
      setChannels((prev) =>
        prev.map((item) => (item.id === response.channel.id ? response.channel : item)),
      )
      showNotification('سین خودکار غیرفعال شد', 'info')
    } catch (error) {
      showNotification(error instanceof Error ? error.message : 'عملیات ناموفق بود', 'error')
    }
  }

  const handleDelete = async (channel: AutoChannelViewChannel) => {
    haptic('medium')
    try {
      await deleteAutoChannelViewChannel(channel.id)
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
    <div className="channel-views channel-views-auto">
      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification((prev) => ({ ...prev, show: false }))}
      />

      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title={headerTitle} onBack={handleBack} />
      </div>

      <div className="channel-views__body">
        {view === 'list' ? (
          <section
            className="channel-views__hero shop-rise"
            style={{ '--rise-index': 1 } as CSSProperties}
            aria-label="سین خودکار"
          >
            <div className="channel-views__image-wrap" aria-hidden>
              <div className="channel-views__image-glow" />
              <img
                src={heroConfig.stillSrc}
                alt=""
                className={`channel-views__image channel-views__image--still${
                  animatedReady ? ' channel-views__image--hidden' : ''
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
                className={`channel-views__image channel-views__image--animated${
                  animatedReady ? ' channel-views__image--visible' : ''
                }`}
                width={90}
                height={90}
                decoding="async"
                onLoad={() => setAnimatedReady(true)}
              />
            </div>

            <p className="channel-views__desc">{heroDescription}</p>
          </section>
        ) : null}

        {view === 'list' ? (
          <>
            {isLoading && channels.length === 0 ? (
              <>
                <div
                  className="channel-views__section-head shop-rise"
                  style={{ '--rise-index': 2 } as CSSProperties}
                >
                  <h2 className="channel-views__section-title">کانال‌های شما</h2>
                </div>
                <section
                  className="channel-views-auto__list shop-rise"
                  style={{ '--rise-index': 3 } as CSSProperties}
                  aria-busy="true"
                  aria-label="در حال بارگذاری کانال‌ها"
                >
                  {[0, 1, 2].map((index) => (
                    <div
                      key={index}
                      className="channel-views-auto__row channel-views-auto__row--skeleton"
                    >
                      <div className="channel-views-auto__row-main">
                        <span className="channel-views-auto__skel channel-views-auto__skel-title" />
                        <span className="channel-views-auto__skel channel-views-auto__skel-meta" />
                      </div>
                      <div className="channel-views-auto__row-actions">
                        <span className="channel-views-auto__skel channel-views-auto__skel-btn" />
                        <span className="channel-views-auto__skel channel-views-auto__skel-btn" />
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
                  className="channel-views__section-head shop-rise"
                  style={{ '--rise-index': 2 } as CSSProperties}
                >
                  <h2 className="channel-views__section-title">کانال‌های شما</h2>
                </div>
                <section
                  className="channel-views-auto__list shop-rise"
                  style={{ '--rise-index': 3 } as CSSProperties}
                  aria-label="کانال‌های ثبت‌شده"
                >
                  {channels.map((channel) => (
                    <article
                      key={channel.id}
                      className={`channel-views-auto__row${
                        channel.isActive ? '' : ' is-off'
                      }`}
                    >
                      <button
                        type="button"
                        className="channel-views-auto__row-main"
                        onClick={() => openConfigure(channel)}
                      >
                        <span className="channel-views-auto__row-avatar" aria-hidden>
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
                        <span className="channel-views-auto__row-body">
                          <span className="channel-views-auto__row-title-line">
                            <strong className="channel-views-auto__row-title">
                              {channel.title}
                            </strong>
                            <span
                              className={`channel-views-auto__badge${
                                channel.isActive ? ' channel-views-auto__badge--on' : ''
                              }`}
                            >
                              {channel.isActive ? 'فعال' : 'غیرفعال'}
                            </span>
                          </span>
                          <span className="channel-views-auto__row-meta">
                            <span className="channel-views-auto__row-username">
                              @{channel.username}
                            </span>
                            {channel.quantity > 0 ? (
                              <span className="channel-views-auto__row-chip">
                                {channel.quantity.toLocaleString('fa-IR')} بازدید
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </button>

                      <div className="channel-views-auto__row-actions">
                        <button
                          type="button"
                          className="channel-views-auto__icon-btn"
                          aria-label="تنظیم کانال"
                          onClick={() => openConfigure(channel)}
                        >
                          <EditIcon width={15} height={15} />
                        </button>
                        {channel.isActive ? (
                          <button
                            type="button"
                            className="channel-views-auto__icon-btn is-pause"
                            aria-label="توقف سین خودکار"
                            onClick={() => void handleDeactivate(channel)}
                          >
                            <LockIcon width={15} height={15} locked />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="channel-views-auto__icon-btn is-danger"
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
              className="channel-views-auto__steps shop-rise"
              style={{ '--rise-index': 2 } as CSSProperties}
            >
              <div className="channel-views-auto__step">
                <span className="channel-views-auto__step-num">۱</span>
                <div className="channel-views-auto__step-body">
                  <strong>افزودن ربات به‌عنوان ادمین</strong>
                  <p>
                    ربات @{botUsername} را در کانال خود ادمین کنید تا بتواند پست‌های جدید را
                    دریافت و پردازش کند.
                  </p>
                  <button
                    type="button"
                    className="channel-views-auto__link-btn"
                    onClick={() => {
                      haptic('light')
                      openExternal(botDeepLink || `https://t.me/${botUsername}`)
                    }}
                  >
                    افزودن ربات به کانال
                  </button>
                </div>
              </div>

              <div className="channel-views-auto__step">
                <span className="channel-views-auto__step-num">۲</span>
                <div className="channel-views-auto__step-body">
                  <strong>وارد کردن لینک پست کانال</strong>
                  <p>
                    لینک یکی از پست‌های عمومی کانال را وارد کنید تا کانال شناسایی و ثبت شود.
                  </p>
                </div>
              </div>
            </section>

            <section
              className="channel-views__post-link shop-rise"
              style={{ '--rise-index': 3 } as CSSProperties}
            >
              <div className="channel-views__section-head">
                <h2 className="channel-views__section-title">لینک پست کانال</h2>
              </div>
              <div
                className={`channel-views__field${registerError ? ' channel-views__field--error' : ''}`}
              >
                {postLink ? (
                  <button
                    type="button"
                    className="channel-views__clear-btn"
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
                <span className="channel-views__field-icon" aria-hidden>
                  {isRegistering ? (
                    <span className="channel-views__spinner" />
                  ) : (
                    <Link01Icon width={18} height={18} />
                  )}
                </span>
                <input
                  type="url"
                  className="channel-views__field-input"
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
                <p className="channel-views__field-error" role="alert">
                  {registerError}
                </p>
              ) : null}
            </section>
          </>
        ) : null}

        {view === 'configure' && selectedChannel ? (
          <>
            <section
              className="channel-views-auto__selected shop-rise"
              style={{ '--rise-index': 1 } as CSSProperties}
            >
              <span className="channel-views-auto__row-avatar" aria-hidden>
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
              <div className="channel-views-auto__row-body">
                <strong className="channel-views-auto__row-title">{selectedChannel.title}</strong>
                <span className="channel-views-auto__row-username" dir="ltr">
                  @{selectedChannel.username}
                </span>
              </div>
            </section>

            <section
              className="channel-views__quantity shop-rise"
              style={{ '--rise-index': 2 } as CSSProperties}
              aria-label="تعداد بازدید"
            >
              <div className="channel-views__section-head">
                <h2 className="channel-views__section-title">بازدید پست‌های جدید</h2>
                <span className="channel-views__section-hint">
                  از {CHANNEL_VIEW_SERVICE.min.toLocaleString('fa-IR')} تا{' '}
                  {CHANNEL_VIEW_SERVICE.max.toLocaleString('fa-IR')}
                </span>
              </div>

              <div
                className={`channel-views__field channel-views__field--quantity${
                  quantityConfirmed ? ' channel-views__field--found' : ''
                }${quantityError ? ' channel-views__field--error' : ''}`}
              >
                {quantityConfirmed ? (
                  <>
                    <button
                      type="button"
                      className="channel-views__clear-btn"
                      onClick={() => {
                        haptic('light')
                        setQuantityInput('')
                        setCommittedQuantity(null)
                        setQuantityError(null)
                      }}
                      aria-label="پاک کردن تعداد"
                    >
                      <Delete02Icon width={18} height={18} color="currentColor" />
                    </button>
                    <div className="channel-views__quantity-summary">
                      <div className="channel-views__quantity-count">
                        {quantity.toLocaleString('fa-IR')} بازدید
                      </div>
                      <div className="channel-views__quantity-price">
                        <span className="channel-views__quantity-price-value">
                          {totalToman.toLocaleString('fa-IR')}
                        </span>
                        <span className="channel-views__quantity-price-unit">تومان</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="channel-views__field-icon" aria-hidden>
                      <ViewIcon width={18} height={18} />
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="channel-views__field-input channel-views__field-input--quantity"
                      value={quantityInput}
                      onChange={(e) => {
                        const value = e.target.value
                        if (!/^[0-9]*$/.test(value)) return
                        setQuantityInput(value)
                        setCommittedQuantity(null)
                        setQuantityError(null)
                      }}
                      placeholder="تعداد بازدید را وارد کنید..."
                      autoComplete="off"
                      spellCheck={false}
                      aria-label="تعداد بازدید"
                    />
                  </>
                )}
              </div>

              {quantityError ? (
                <p className="channel-views__field-error" role="alert">
                  {quantityError}
                </p>
              ) : null}
            </section>

            <label
              className="channel-views-auto__random shop-rise"
              style={{ '--rise-index': 3 } as CSSProperties}
            >
              <input
                type="checkbox"
                className="channel-views-auto__random-input"
                checked={randomizeQuantity}
                onChange={(event) => {
                  haptic('light')
                  setRandomizeQuantity(event.target.checked)
                }}
              />
              <span className="channel-views-auto__random-content">
                <span className="channel-views-auto__random-title">تغییر اعداد به‌صورت تصادفی</span>
                <span className="channel-views-auto__random-desc">
                  با فعال‌سازی این گزینه، تعداد بازدید در هر پست جدید به‌نسبت مقدار انتخابی شما
                  کمی بیشتر یا کمتر می‌شود؛ مثلاً حدود ۶۰ بازدید حدود ±۶ و حدود ۶۰۰ بازدید حدود ±۳۰
                  واحد تغییر می‌کند تا طبیعی‌تر به نظر برسد.
                </span>
              </span>
            </label>

            {quantityConfirmed ? (
              <section
                className="channel-views-auto__summary shop-rise"
                style={{ '--rise-index': 4 } as CSSProperties}
              >
                <span>
                  {randomizeQuantity ? 'هزینه تقریبی هر پست جدید' : 'هزینه هر پست جدید'}
                </span>
                <strong>
                  {totalToman.toLocaleString('fa-IR')} <span>تومان</span>
                </strong>
              </section>
            ) : null}
          </>
        ) : null}
      </div>

      <footer
        className="channel-views__footer shop-rise"
        style={{ '--rise-index': 5 } as CSSProperties}
      >
        {view === 'list' ? (
          <button
            type="button"
            className="channel-views__continue"
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
            className="channel-views__continue"
            disabled={isRegistering || !postLink.trim()}
            onClick={() => void handleRegister()}
          >
            {isRegistering ? 'در حال بررسی...' : 'ثبت کانال'}
          </button>
        ) : null}

        {view === 'configure' ? (
          <button
            type="button"
            className="channel-views__continue"
            disabled={!canSave}
            onClick={() => void handleSaveConfig()}
          >
            {isSaving ? 'در حال ذخیره...' : 'فعال‌سازی سین خودکار'}
          </button>
        ) : null}
      </footer>
    </div>
  )
}
