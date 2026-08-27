import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import FavouriteIcon from '../components/icons/FavouriteIcon'
import OrderIcon from '../components/icons/OrderIcon'
import PaymentHistoryIcon from '../components/icons/PaymentHistoryIcon'
import PhoneIcon from '../components/icons/PhoneIcon'
import ShopIcon from '../components/icons/ShopIcon'
import { useUser } from '../context/UserContext'
import { useTelegram } from '../hooks/useTelegram'
import { fetchClubPoints } from '../lib/club'
import {
  fetchMyOrders,
  filterShopOrders,
  filterVirtualNumberOrders,
  readLocalMyOrders,
  syncMyOrders,
  writeLocalMyOrders,
  type MyOrdersPayload,
  type ShopOrder,
} from '../lib/orders'
import { shopCategories } from '../data/shopCategories'
import { ACCOUNT_SHOP_CATEGORY_OPTIONS } from '../data/accountShopCategories'
import { formatFaNumber, userOrderStatusLabel, userOrderStatusTone } from './admin/adminLabels'
import '../styles/shop-rise.css'
import './Dashboard.css'

function accountShopCategoryMeta(order: ShopOrder) {
  const categoryId = order.accountShopOrder?.accountCategoryId
  if (!categoryId) return null
  return ACCOUNT_SHOP_CATEGORY_OPTIONS.find((item) => item.id === categoryId) ?? null
}

function quantityLabel(order: ShopOrder): string {
  const qty = order.quantity
  switch (order.category.slug) {
    case 'telegram-stars':
      return qty ? `${formatFaNumber(qty)} استارز` : '—'
    case 'telegram-premium':
      return qty ? `${formatFaNumber(qty)} ماه` : '—'
    case 'virtual-number':
      return order.recipientName?.trim() || order.virtualNumber?.country || 'شماره مجازی'
    case 'reaction':
      return qty ? `${formatFaNumber(qty)} ری‌اکشن` : 'ری‌اکشن'
    case 'channel-views':
      return `${formatFaNumber(order.channelViewOrder?.quantity ?? qty ?? 0)} سین`
    case 'telegram-members':
      return `${formatFaNumber(order.telegramMemberOrder?.quantity ?? qty ?? 0)} ممبر`
    case 'chatgpt':
      return order.accountShopOrder?.planName ?? order.recipientName ?? order.category.label
    default:
      return order.category.label
  }
}

function orderTimeIso(order: ShopOrder): string {
  if (order.status === 'completed' && order.fulfilledAt) return order.fulfilledAt
  if ((order.status === 'failed' || order.status === 'cancelled') && order.failedAt) {
    return order.failedAt
  }
  return order.createdAt
}

function formatRelativeFa(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''

  const diffMs = Date.now() - date.getTime()
  const minutes = Math.max(0, Math.floor(diffMs / 60_000))

  if (minutes < 1) return 'همین الان'
  if (minutes < 60) return `${formatFaNumber(minutes)} دقیقه پیش`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${formatFaNumber(hours)} ساعت پیش`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${formatFaNumber(days)} روز پیش`

  return date.toLocaleDateString('fa-IR', {
    month: 'short',
    day: 'numeric',
  })
}

function paymentMethodShort(method: ShopOrder['paymentMethod']): string {
  switch (method) {
    case 'wallet':
      return 'کیف پول'
    case 'zibal':
      return 'درگاه'
    case 'tron':
      return 'ترون'
    default:
      return method
  }
}

export function HomePage() {
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const { user, isLoading: userLoading, isAuthenticated } = useUser()
  const localOrders = readLocalMyOrders()
  const [latestOrder, setLatestOrder] = useState<ShopOrder | null>(
    () => filterShopOrders(localOrders?.items ?? [])[0] ?? null,
  )
  const [virtualNumbersCount, setVirtualNumbersCount] = useState(
    () => filterVirtualNumberOrders(localOrders?.items ?? []).length,
  )
  const [ordersLoading, setOrdersLoading] = useState(() => !localOrders)
  const [clubPoints, setClubPoints] = useState(user?.clubPoints ?? 0)

  const applyOrdersPayload = useCallback((payload: MyOrdersPayload) => {
    writeLocalMyOrders(payload)
    setLatestOrder(filterShopOrders(payload.items)[0] ?? null)
    setVirtualNumbersCount(filterVirtualNumberOrders(payload.items).length)
  }, [])

  const refreshOrdersInBackground = useCallback(
    async (version?: string | null) => {
      try {
        const syncResult = await syncMyOrders(version ?? undefined)
        if (syncResult.changed) {
          applyOrdersPayload(syncResult)
        }
      } catch {
        // background sync must not block dashboard
      }
    },
    [applyOrdersPayload],
  )

  const loadOrders = useCallback(async () => {
    if (!isAuthenticated) {
      setLatestOrder(null)
      setOrdersLoading(false)
      return
    }

    const localCache = readLocalMyOrders()
    if (localCache) {
      applyOrdersPayload(localCache)
      setOrdersLoading(false)
      void refreshOrdersInBackground(localCache.version)
      return
    }

    setOrdersLoading(true)
    try {
      const payload = await fetchMyOrders()
      applyOrdersPayload(payload)
      void refreshOrdersInBackground(payload.version)
    } catch {
      setLatestOrder(null)
    } finally {
      setOrdersLoading(false)
    }
  }, [applyOrdersPayload, isAuthenticated, refreshOrdersInBackground])

  useEffect(() => {
    if (userLoading) return
    void loadOrders()
  }, [loadOrders, userLoading])

  useEffect(() => {
    if (userLoading || !isAuthenticated) return

    void fetchClubPoints()
      .then((result) => setClubPoints(result.clubPoints))
      .catch(() => {
        if (user?.clubPoints != null) setClubPoints(user.clubPoints)
      })
  }, [isAuthenticated, user?.clubPoints, userLoading])

  const go = (path: string, state?: { returnTo?: string }) => {
    haptic('light')
    navigate(path, state ? { state } : undefined)
  }

  const loading = (userLoading || ordersLoading) && !latestOrder

  const accountCategory = latestOrder ? accountShopCategoryMeta(latestOrder) : null
  const categoryMeta = latestOrder
    ? shopCategories.find((item) => item.id === latestOrder.category.slug)
    : null
  const CategoryIcon = categoryMeta?.icon
  const orderIconSrc = accountCategory?.stillImageSrc ?? accountCategory?.imageSrc ?? null
  /** Account images use solid black/white (theme); other products keep category gradient. */
  const orderIconBackground = orderIconSrc
    ? undefined
    : (categoryMeta?.gradient ?? 'var(--surface-elevated)')
  const orderTitle =
    accountCategory?.label ??
    latestOrder?.accountShopOrder?.planName ??
    latestOrder?.category.label ??
    ''

  return (
    <div className="dash">
      <div className="dash__content">
        <section className="dash__section shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
          <h2 className="dash__section-title">وضعیت آخرین سفارش شما</h2>
          {loading ? (
            <div className="dash__order-card dash__order-card--static">
              <div className="dash__skeleton">
                <div className="dash__skeleton-icon" />
                <div className="dash__skeleton-lines">
                  <div className="dash__skeleton-line" style={{ width: '58%' }} />
                  <div className="dash__skeleton-line" style={{ width: '36%' }} />
                </div>
                <div className="dash__skeleton-badge" />
              </div>
              <div className="dash__order-foot">
                <div className="dash__skeleton-line" style={{ width: '42%' }} />
                <div className="dash__skeleton-line" style={{ width: '28%' }} />
              </div>
            </div>
          ) : latestOrder ? (
            <button
              type="button"
              className="dash__order-card"
              onClick={() => go(`/orders/${encodeURIComponent(latestOrder.orderId)}`)}
            >
              <div className="dash__order-main">
                <div
                  className={`dash__order-icon${orderIconSrc ? ' dash__order-icon--image' : ''}`}
                  style={orderIconBackground ? { background: orderIconBackground } : undefined}
                >
                  {orderIconSrc ? (
                    <img src={orderIconSrc} alt="" width={44} height={44} />
                  ) : CategoryIcon ? (
                    <CategoryIcon width={22} height={22} color={categoryMeta?.iconColor ?? '#fff'} />
                  ) : (
                    <ShopIcon width={22} height={22} color="#fff" />
                  )}
                </div>
                <div className="dash__order-copy">
                  <strong className="dash__order-name">{orderTitle}</strong>
                  <span className="dash__order-meta">{quantityLabel(latestOrder)}</span>
                </div>
                <div className="dash__order-side">
                  <span className={`dash__badge dash__badge--${userOrderStatusTone(latestOrder)}`}>
                    {userOrderStatusLabel(latestOrder)}
                  </span>
                  <span className="dash__order-time">{formatRelativeFa(orderTimeIso(latestOrder))}</span>
                </div>
              </div>
              <div className="dash__order-foot">
                <div className="dash__order-foot-start">
                  <span className="dash__order-pay">{paymentMethodShort(latestOrder.paymentMethod)}</span>
                  <span className="dash__order-dot" aria-hidden="true" />
                  <span className="dash__order-id" dir="ltr">
                    {latestOrder.orderId}
                  </span>
                </div>
                <span className="dash__order-price">
                  {formatFaNumber(Number(latestOrder.amountToman))}
                  <span> تومان</span>
                </span>
              </div>
            </button>
          ) : (
            <div className="dash__order-card dash__order-card--static dash__empty">
              <EmptyState compact title="هنوز سفارشی ثبت نشده است" />
            </div>
          )}
        </section>

        <section className="dash__section shop-rise" style={{ '--rise-index': 1 } as CSSProperties}>
          <h2 className="dash__section-title">لیست شماره‌های من</h2>
          <button
            type="button"
            className="dash__order-card"
            onClick={() => go('/my-virtual-numbers')}
          >
            <div className="dash__order-main">
              <div
                className="dash__order-icon"
                style={{
                  background:
                    shopCategories.find((item) => item.id === 'virtual-number')?.gradient ??
                    'var(--surface-elevated)',
                }}
              >
                <PhoneIcon width={22} height={22} color="#fff" />
              </div>
              <div className="dash__order-copy">
                <strong className="dash__order-name">شماره‌های مجازی</strong>
                <span className="dash__order-meta">
                  {virtualNumbersCount > 0
                    ? `${formatFaNumber(virtualNumbersCount)} شماره خریداری‌شده`
                    : 'هنوز شماره‌ای خریداری نشده'}
                </span>
              </div>
              <div className="dash__order-side">
                <span className="dash__order-time">مشاهده</span>
              </div>
            </div>
          </button>
        </section>

        <section className="dash__section shop-rise" style={{ '--rise-index': 2 } as CSSProperties}>
          <h2 className="dash__section-title">دکمه‌های اقدام سریع</h2>
          <div className="dash__actions">
            <button type="button" className="dash__action dash__action--primary" onClick={() => go('/')}>
              <ShopIcon width={18} height={18} />
              خرید محصول جدید
            </button>
            <div className="dash__actions-row">
              <button
                type="button"
                className="dash__action"
                onClick={() => go('/profile/charge-history', { returnTo: '/dashboard' })}
              >
                <PaymentHistoryIcon width={18} height={18} />
                تاریخچه تراکنش
              </button>
              <button type="button" className="dash__action" onClick={() => go('/orders')}>
                <OrderIcon width={18} height={18} />
                لیست سفارشات
              </button>
            </div>
          </div>
        </section>

        <section className="dash__section shop-rise" style={{ '--rise-index': 3 } as CSSProperties}>
          <h2 className="dash__section-title">کلاب و امتیاز</h2>
          <div className="dash__club">
            <div className="dash__club-top">
              <div className="dash__club-icon">
                <FavouriteIcon width={20} height={20} />
              </div>
              <div className="dash__club-copy">
                <h3 className="dash__club-title">امتیاز کلاب شما</h3>
                <p className="dash__club-desc">
                  با هر خرید موفق امتیاز می‌گیرید و می‌توانید از جوایز کلاب استفاده کنید.
                </p>
              </div>
            </div>
            <div className="dash__club-footer">
              <div className="dash__club-points">
                <strong>{formatFaNumber(clubPoints)}</strong>
                <span>امتیاز</span>
              </div>
              <button
                type="button"
                className="dash__club-btn"
                onClick={() => go('/profile/charge-history', { returnTo: '/dashboard' })}
              >
                مشاهده جزئیات
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
