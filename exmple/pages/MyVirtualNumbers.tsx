import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CountryFlagImg } from '../components/CountryFlagImg'
import { CenterModal } from '../components/CenterModal'
import { EmptyState } from '../components/EmptyState'
import { Notification } from '../components/Notification'
import { PageHeader } from '../components/PageHeader'
import CopyIcon from '../components/icons/CopyIcon'
import BinaryCodeIcon from '../components/icons/BinaryCodeIcon'
import LogoutIcon from '../components/icons/LogoutIcon'
import { useTelegram } from '../hooks/useTelegram'
import { isTelegramWebApp } from '../lib/api'
import { warmCountryFlagCache } from '../lib/countryFlagCache'
import {
  fetchMyOrders,
  filterVirtualNumberOrders,
  readLocalMyOrders,
  syncMyOrders,
  writeLocalMyOrders,
  type ShopOrder,
} from '../lib/orders'
import { fetchVirtualNumberCode, logoutVirtualNumberAccount, splitVirtualNumber, virtualNumberCodeButtonLabel, virtualNumberCodeNotifyType, virtualNumberLogoutNotifyType, type VirtualNumberCodeStatus } from '../lib/virtualNumber'
import { formatFaNumber } from './admin/adminLabels'
import '../styles/shop-rise.css'
import './MyVirtualNumbers.css'

function toFaDigits(value: string): string {
  return value.replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)] ?? digit)
}

function formatRelativeFa(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'همین الان'
  if (mins < 60) return `${formatFaNumber(mins)} دقیقه پیش`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${formatFaNumber(hours)} ساعت پیش`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${formatFaNumber(days)} روز پیش`
  return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(new Date(iso))
}

function statusLabel(status: ShopOrder['status'], loggedOut: boolean): string {
  if (loggedOut) return 'لوگ اوت شده'
  switch (status) {
    case 'completed':
      return 'فعال'
    case 'processing':
      return 'در حال آماده‌سازی'
    case 'pending':
      return 'در انتظار پرداخت'
    case 'failed':
      return 'ناموفق'
    case 'cancelled':
      return 'لغو شده'
    default:
      return status
  }
}

function sortVirtualNumbersActiveFirst(orders: ShopOrder[]): ShopOrder[] {
  return [...orders].sort((a, b) => {
    const aOut = Boolean(a.virtualNumber?.loggedOutAt)
    const bOut = Boolean(b.virtualNumber?.loggedOutAt)
    if (aOut === bOut) return 0
    return aOut ? 1 : -1
  })
}

function NumberCard({
  order,
  onNotify,
  onCode,
  onLoggedOut,
}: {
  order: ShopOrder
  onNotify: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void
  onCode: (orderId: string, code: string | null) => void
  onLoggedOut: (orderId: string, loggedOutAt: string) => void
}) {
  const { haptic } = useTelegram()
  const vn = order.virtualNumber
  const isLoggedOut = Boolean(vn?.loggedOutAt)
  const [busy, setBusy] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [codeStatus, setCodeStatus] = useState<VirtualNumberCodeStatus | null>(() => {
    if (vn?.loggedOutAt) return 'logged_out'
    if (vn?.code) return 'ready'
    return null
  })
  const [localCode, setLocalCode] = useState(vn?.loggedOutAt ? '' : vn?.code?.trim() || '')
  const codeWaitTimerRef = useRef<number | null>(null)
  const codeRequestIdRef = useRef(0)
  const number = vn?.number?.trim() || ''
  const phoneParts = number ? splitVirtualNumber(number, vn?.range) : null
  const flagCode = order.recipientPhoto?.trim() || ''
  const countryLabel = order.recipientName?.trim() || vn?.country || '—'
  const code = localCode
  const showActiveControls = order.status === 'completed' && Boolean(phoneParts) && !isLoggedOut

  const clearCodeWaitTimer = () => {
    if (codeWaitTimerRef.current != null) {
      window.clearTimeout(codeWaitTimerRef.current)
      codeWaitTimerRef.current = null
    }
  }

  useEffect(() => () => clearCodeWaitTimer(), [])

  const displayParts = phoneParts
    ? (() => {
        const digits = number.replace(/\D/g, '')
        const range = (vn?.range ?? '').replace(/\D/g, '')
        if (range && digits.startsWith(range) && digits.length > range.length) {
          return {
            countryCode: toFaDigits(`+${range}`),
            localNumber: toFaDigits(digits.slice(range.length)),
          }
        }
        return { countryCode: '', localNumber: toFaDigits(phoneParts.display) }
      })()
    : null

  const copyText = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value)
      haptic('light')
      onNotify(successMessage, 'success')
    } catch {
      onNotify('کپی انجام نشد', 'error')
    }
  }

  const handleFetchCode = async () => {
    if (busy || loggingOut || !phoneParts || isLoggedOut) return
    haptic('light')
    clearCodeWaitTimer()
    const requestId = ++codeRequestIdRef.current
    let timedOut = false
    setLocalCode('')
    setCodeStatus('pending')
    onCode(order.orderId, null)
    setBusy(true)

    codeWaitTimerRef.current = window.setTimeout(() => {
      if (codeRequestIdRef.current !== requestId) return
      timedOut = true
      codeWaitTimerRef.current = null
      setBusy(false)
      setCodeStatus(null)
      setLocalCode('')
    }, 10_000)

    try {
      const result = await fetchVirtualNumberCode(order.orderId)
      if (codeRequestIdRef.current !== requestId) return

      if (result.status === 'logged_out') {
        clearCodeWaitTimer()
        setCodeStatus('logged_out')
        setLocalCode('')
        onLoggedOut(order.orderId, new Date().toISOString())
        onNotify(result.message, virtualNumberCodeNotifyType(result.status))
        return
      }

      if (result.status === 'pending') {
        if (timedOut) return
        setCodeStatus('pending')
        setLocalCode('')
        onNotify(result.message, virtualNumberCodeNotifyType(result.status))
        return
      }

      clearCodeWaitTimer()
      setCodeStatus(result.status)
      setLocalCode(result.code?.trim() || '')
      onCode(order.orderId, result.code)
      onNotify(result.message, virtualNumberCodeNotifyType(result.status))
    } catch (err) {
      if (codeRequestIdRef.current !== requestId || timedOut) return
      clearCodeWaitTimer()
      setCodeStatus('not_received')
      setLocalCode('')
      onNotify(err instanceof Error ? err.message : 'دریافت کد ناموفق بود', 'error')
    } finally {
      if (codeRequestIdRef.current === requestId && !timedOut) {
        setBusy(false)
      }
    }
  }

  const handleLogout = async () => {
    if (busy || loggingOut || !phoneParts || isLoggedOut) return
    haptic('light')
    setLoggingOut(true)
    try {
      const result = await logoutVirtualNumberAccount(order.orderId)
      if (result.status === 'logged_out') {
        setCodeStatus('logged_out')
        setLocalCode('')
        onLoggedOut(order.orderId, result.loggedOutAt ?? new Date().toISOString())
      }
      setLogoutConfirmOpen(false)
      onNotify(result.message, virtualNumberLogoutNotifyType(result.status))
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خروج از اکانت ناموفق بود', 'error')
    } finally {
      setLoggingOut(false)
    }
  }

  const statusTone = isLoggedOut ? 'logged_out' : order.status

  return (
    <>
    <article className={`my-vn-card my-vn-card--${order.status}${isLoggedOut ? ' my-vn-card--logged-out' : ''}`}>
      <div className="my-vn-card__top">
        <div className="my-vn-card__meta">
          {flagCode ? (
            <span className="my-vn-card__flag-wrap">
              <CountryFlagImg flagCode={flagCode} className="my-vn-card__flag" width={28} height={28} />
            </span>
          ) : null}
          <div className="my-vn-card__titles">
            <span className="my-vn-card__country">{countryLabel}</span>
            {vn?.service ? <span className="my-vn-card__service">{vn.service}</span> : null}
          </div>
        </div>
        <div className="my-vn-card__top-aside">
          <time className="my-vn-card__time" dateTime={order.createdAt}>
            {formatRelativeFa(order.createdAt)}
          </time>
          <span className={`my-vn-card__status my-vn-card__status--${statusTone}`}>
            {statusLabel(order.status, isLoggedOut)}
          </span>
        </div>
      </div>

      {displayParts && phoneParts ? (
        <div className="my-vn-card__body">
          <div className="my-vn-card__number" dir="ltr">
            {displayParts.countryCode ? (
              <span className="my-vn-card__cc">{displayParts.countryCode}</span>
            ) : null}
            <span className="my-vn-card__local">{displayParts.localNumber}</span>
          </div>

          {!isLoggedOut ? (
            <div className="my-vn-card__copies">
              <button
                type="button"
                className="my-vn-card__copy"
                onClick={() => void copyText(phoneParts.withoutPrefix, 'شماره بدون پیش‌شماره کپی شد')}
              >
                <CopyIcon width={13} height={13} />
                بدون پیش‌شماره
              </button>
              <button
                type="button"
                className="my-vn-card__copy"
                onClick={() => void copyText(phoneParts.withPrefix, 'شماره با پیش‌شماره کپی شد')}
              >
                <CopyIcon width={13} height={13} />
                با پیش‌شماره
              </button>
            </div>
          ) : null}

          {showActiveControls ? (
            <div className="my-vn-card__code-block">
              <button
                type="button"
                className="my-vn-card__code-row"
                disabled={!code}
                onClick={() => {
                  if (!code) return
                  void copyText(code, 'کد تأیید کپی شد')
                }}
              >
                <span className="my-vn-card__code-label">کد تأیید</span>
                <span
                  className={`my-vn-card__code-value${!code || busy || codeStatus === 'pending' || codeStatus === 'logged_out' || codeStatus === 'not_received' ? ' my-vn-card__code-value--muted' : ''}`}
                  dir={code && !busy && codeStatus !== 'pending' ? 'ltr' : 'rtl'}
                >
                  {busy || codeStatus === 'pending'
                    ? 'در انتظار کد...'
                    : code
                      ? toFaDigits(code)
                      : codeStatus === 'not_received'
                        ? 'کد دریافت نشده'
                        : '—'}
                </span>
                {code ? (
                  <span className="my-vn-card__code-copy" aria-hidden="true">
                    <CopyIcon width={14} height={14} />
                  </span>
                ) : null}
              </button>
            </div>
          ) : null}

          {isLoggedOut ? (
            <p className="my-vn-card__logged-out-note">شما از این شماره لوگ اوت کرده‌اید</p>
          ) : null}
        </div>
      ) : (
        <p className="my-vn-card__pending-number">شماره هنوز تخصیص داده نشده</p>
      )}

      {showActiveControls ? (
        <div className="my-vn-card__footer">
          <button
            type="button"
            className="my-vn-card__logout-btn"
            disabled={busy || loggingOut}
            onClick={() => {
              haptic('light')
              setLogoutConfirmOpen(true)
            }}
          >
            <LogoutIcon width={14} height={14} />
            خروج
          </button>
          <button
            type="button"
            className={`my-vn-card__code-btn${codeStatus ? ` my-vn-card__code-btn--${codeStatus}` : ''}`}
            disabled={busy || loggingOut}
            onClick={() => void handleFetchCode()}
          >
            <BinaryCodeIcon width={15} height={15} />
            {virtualNumberCodeButtonLabel(codeStatus, busy, Boolean(code))}
          </button>
        </div>
      ) : null}
    </article>

    <CenterModal
      isOpen={logoutConfirmOpen}
      onClose={() => {
        if (loggingOut) return
        setLogoutConfirmOpen(false)
      }}
      title="تأیید خروج از حساب"
      description="ما از طریق وب‌سرویس به حساب تلگرام این شماره متصلیم و به پیام‌های شما دسترسی نداریم. با این اتصال می‌توانیم کد ورود را دوباره دریافت کنیم؛ با خروج قطعی، این دسترسی حذف می‌شود و مسئولیت نگهداری حساب بر عهده شماست."
      showCloseButton={!loggingOut}
      buttons={[
        {
          label: 'انصراف',
          onClick: () => setLogoutConfirmOpen(false),
          disabled: loggingOut,
        },
        {
          label: loggingOut ? 'در حال خروج...' : 'خروج قطعی',
          onClick: () => void handleLogout(),
          variant: 'danger',
          disabled: loggingOut,
        },
      ]}
    />
    </>
  )
}

export function MyVirtualNumbersPage() {
  const navigate = useNavigate()
  const cached = readLocalMyOrders()
  const [items, setItems] = useState<ShopOrder[]>(() =>
    filterVirtualNumberOrders(cached?.items ?? []),
  )
  const [loading, setLoading] = useState(!cached)
  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  }>({ show: false, message: '', type: 'success' })

  const handleBack = useCallback(() => {
    navigate('/dashboard')
  }, [navigate])

  const sortedItems = useMemo(() => sortVirtualNumbersActiveFirst(items), [items])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const local = readLocalMyOrders()
        if (local) {
          const sync = await syncMyOrders(local.version)
          if (cancelled) return
          if (sync.changed) {
            writeLocalMyOrders({
              version: sync.version,
              cachedAt: new Date().toISOString(),
              items: sync.items,
            })
            setItems(filterVirtualNumberOrders(sync.items))
          } else {
            setItems(filterVirtualNumberOrders(local.items))
          }
        } else {
          const data = await fetchMyOrders()
          if (cancelled) return
          writeLocalMyOrders(data)
          setItems(filterVirtualNumberOrders(data.items))
        }
      } catch {
        if (!cancelled && !cached) setItems([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const codes = items
      .map((order) => order.recipientPhoto?.trim() || '')
      .filter(Boolean)
    if (codes.length > 0) void warmCountryFlagCache(codes)
  }, [items])

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

  const handleCode = (orderId: string, code: string | null) => {
    setItems((prev) =>
      prev.map((order) =>
        order.orderId === orderId && order.virtualNumber
          ? { ...order, virtualNumber: { ...order.virtualNumber, code } }
          : order,
      ),
    )
    const local = readLocalMyOrders()
    if (!local) return
    writeLocalMyOrders({
      ...local,
      items: local.items.map((order) =>
        order.orderId === orderId && order.virtualNumber
          ? { ...order, virtualNumber: { ...order.virtualNumber, code } }
          : order,
      ),
    })
  }

  const handleLoggedOut = (orderId: string, loggedOutAt: string) => {
    const patch = (order: ShopOrder): ShopOrder =>
      order.orderId === orderId && order.virtualNumber
        ? {
            ...order,
            virtualNumber: {
              ...order.virtualNumber,
              code: null,
              loggedOutAt,
            },
          }
        : order

    setItems((prev) => prev.map(patch))
    const local = readLocalMyOrders()
    if (!local) return
    writeLocalMyOrders({
      ...local,
      items: local.items.map(patch),
    })
  }

  const onNotify = (message: string, type: 'success' | 'error' | 'warning' | 'info') => {
    setNotification({ show: true, message, type })
  }

  return (
    <div className="my-vn">
      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title="لیست شماره‌های من" onBack={handleBack} />
      </div>

      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification((prev) => ({ ...prev, show: false }))}
      />

      <div className="my-vn__content">
        {loading ? (
          <div className="my-vn-list shop-rise" style={{ '--rise-index': 1 } as CSSProperties} aria-busy="true">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="my-vn-card my-vn-card--skeleton" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="my-vn-list shop-rise" style={{ '--rise-index': 1 } as CSSProperties}>
            <EmptyState
              title="هنوز شماره‌ای خریداری نکرده‌اید"
              description="شماره‌های مجازی خریداری‌شده اینجا نمایش داده می‌شوند."
              action={
                <Link to="/virtual-number" className="my-vn-empty__cta">
                  خرید شماره مجازی
                </Link>
              }
            />
          </div>
        ) : (
          <div className="my-vn-list shop-rise" style={{ '--rise-index': 1 } as CSSProperties}>
            {sortedItems.map((order) => (
              <NumberCard
                key={order.orderId}
                order={order}
                onNotify={onNotify}
                onCode={handleCode}
                onLoggedOut={handleLoggedOut}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
