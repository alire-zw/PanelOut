import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/EmptyState'
import ShopIcon from '../components/icons/ShopIcon'
import { shopCategories } from '../data/shopCategories'
import { ACCOUNT_SHOP_CATEGORY_OPTIONS } from '../data/accountShopCategories'
import { useUser } from '../context/UserContext'
import { useTelegram } from '../hooks/useTelegram'
import { isTelegramWebApp } from '../lib/api'
import {
  fetchMyOrders,
  filterShopOrders,
  readLocalMyOrders,
  syncMyOrders,
  writeLocalMyOrders,
  type MyOrdersPayload,
  type ShopOrder,
} from '../lib/orders'
import { formatFaNumber, userOrderStatusLabel, userOrderStatusTone } from './admin/adminLabels'
import '../styles/shop-rise.css'
import './OrdersList.css'

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

function formatFaDate(value: string): string {
  return new Date(value).toLocaleDateString('fa-IR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

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

export function OrdersListPage() {
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const { isLoading: userLoading, isAuthenticated } = useUser()
  const localCache = readLocalMyOrders()
  const [orders, setOrders] = useState<ShopOrder[]>(() =>
    filterShopOrders(localCache?.items ?? []),
  )
  const [hasFetched, setHasFetched] = useState(() => Boolean(localCache))
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleBack = useCallback(() => {
    navigate('/dashboard')
  }, [navigate])

  const applyPayload = useCallback((payload: MyOrdersPayload) => {
    writeLocalMyOrders(payload)
    setOrders(filterShopOrders(payload.items))
  }, [])

  const refreshInBackground = useCallback(
    async (version?: string | null) => {
      setIsRefreshing(true)
      try {
        const syncResult = await syncMyOrders(version ?? undefined)
        if (syncResult.changed) applyPayload(syncResult)
      } catch {
        // background sync must not block list
      } finally {
        setIsRefreshing(false)
      }
    },
    [applyPayload],
  )

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setOrders([])
      setHasFetched(true)
      return
    }

    const local = readLocalMyOrders()
    if (local) {
      applyPayload(local)
      setHasFetched(true)
      void refreshInBackground(local.version)
      return
    }

    try {
      const payload = await fetchMyOrders()
      applyPayload(payload)
      void refreshInBackground(payload.version)
    } catch {
      setOrders([])
    } finally {
      setHasFetched(true)
    }
  }, [applyPayload, isAuthenticated, refreshInBackground])

  useEffect(() => {
    if (userLoading) return
    void load()
  }, [load, userLoading])

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

  const showSkeleton = !hasFetched && orders.length === 0

  return (
    <div className="orders-list">
      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader
          title="لیست سفارشات"
          onBack={handleBack}
          action={
            isRefreshing ? (
              <span className="orders-list__sync" aria-label="در حال بروزرسانی" />
            ) : null
          }
        />
      </div>

      <div className="orders-list__content">
        {showSkeleton ? (
          <div className="orders-list__panel shop-rise" style={{ '--rise-index': 1 } as CSSProperties}>
            {[0, 1, 2].map((index) => (
              <div key={index} className="orders-list__card orders-list__card--skeleton">
                <span className="orders-list__skel-icon" />
                <span className="orders-list__skel-body">
                  <span className="orders-list__skel-title" />
                  <span className="orders-list__skel-meta" />
                </span>
              </div>
            ))}
          </div>
        ) : hasFetched && orders.length === 0 ? (
          <div className="orders-list__panel shop-rise" style={{ '--rise-index': 1 } as CSSProperties}>
            <EmptyState title="هنوز سفارشی ثبت نشده است" />
          </div>
        ) : (
          <div className="orders-list__panel shop-rise" style={{ '--rise-index': 1 } as CSSProperties}>
            {orders.map((order) => {
              const accountCategory = accountShopCategoryMeta(order)
              const categoryMeta = shopCategories.find((item) => item.id === order.category.slug)
              const CategoryIcon = categoryMeta?.icon
              const orderIconSrc = accountCategory?.stillImageSrc ?? accountCategory?.imageSrc ?? null
              const orderTitle =
                accountCategory?.label ??
                order.accountShopOrder?.planName ??
                order.category.label
              return (
                <button
                  key={order.orderId}
                  type="button"
                  className="orders-list__card"
                  onClick={() => {
                    haptic('light')
                    navigate(`/orders/${encodeURIComponent(order.orderId)}`)
                  }}
                >
                  <span
                    className={`orders-list__card-icon${orderIconSrc ? ' orders-list__card-icon--image' : ''}`}
                    style={{
                      background:
                        accountCategory?.gradient ??
                        categoryMeta?.gradient ??
                        'var(--surface-elevated)',
                    }}
                  >
                    {orderIconSrc ? (
                      <img src={orderIconSrc} alt="" width={32} height={32} />
                    ) : CategoryIcon ? (
                      <CategoryIcon width={16} height={16} color={categoryMeta?.iconColor ?? '#fff'} />
                    ) : (
                      <ShopIcon width={16} height={16} color="#fff" />
                    )}
                  </span>
                  <span className="orders-list__card-body">
                    <span className="orders-list__card-top">
                      <span className="orders-list__card-title">{orderTitle}</span>
                      <span className={`orders-list__badge orders-list__badge--${userOrderStatusTone(order)}`}>
                        {userOrderStatusLabel(order)}
                      </span>
                    </span>
                    <span className="orders-list__card-meta">
                      {quantityLabel(order)}
                      {' · '}
                      {formatFaNumber(Number(order.amountToman))} تومان
                      {' · '}
                      {formatFaDate(order.createdAt)}
                    </span>
                  </span>
                  <span className="orders-list__card-arrow">
                    <ArrowIcon />
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
