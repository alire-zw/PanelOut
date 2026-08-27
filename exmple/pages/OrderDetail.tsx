import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { Notification } from '../components/Notification'
import { PageHeader } from '../components/PageHeader'
import ContactIcon from '../components/icons/ContactIcon'
import CopyIcon from '../components/icons/CopyIcon'
import ShopIcon from '../components/icons/ShopIcon'
import { ACCOUNT_SHOP_CATEGORY_OPTIONS } from '../data/accountShopCategories'
import { shopCategories } from '../data/shopCategories'
import { useTelegram } from '../hooks/useTelegram'
import { isTelegramWebApp } from '../lib/api'
import { fetchOrder, type ShopOrder } from '../lib/orders'
import {
  formatFaDateTimeLong,
  formatFaNumber,
  paymentMethodLabel,
  userOrderStatusLabel,
} from './admin/adminLabels'
import '../styles/shop-rise.css'
import './OrderDetail.css'

type DetailCell = {
  label: string
  value: ReactNode
  valueClassName?: string
  copyValue?: string
}

type DetailGroup = {
  cols: 1 | 2 | 3
  cells: DetailCell[]
}

function statusValueClass(order: ShopOrder): string {
  if (order.category.slug === 'chatgpt') {
    if (order.status === 'failed' || order.status === 'cancelled') {
      return 'order-detail__value--failed'
    }
    if (order.status === 'pending' || order.accountShopOrder?.status === 'processing') {
      return 'order-detail__value--pending'
    }
    return 'order-detail__value--success'
  }
  if (order.status === 'completed') return 'order-detail__value--success'
  if (order.status === 'failed' || order.status === 'cancelled') return 'order-detail__value--failed'
  if (order.status === 'pending' || order.status === 'processing') return 'order-detail__value--pending'
  return ''
}

function quantitySummary(order: ShopOrder): string | null {
  const qty = order.quantity
  switch (order.category.slug) {
    case 'telegram-stars':
      return qty ? `${formatFaNumber(qty)} استارز` : null
    case 'telegram-premium':
      return qty ? `${formatFaNumber(qty)} ماه` : null
    case 'reaction':
      return qty ? `${formatFaNumber(qty)} ری‌اکشن` : null
    case 'channel-views':
      return `${formatFaNumber(order.channelViewOrder?.quantity ?? qty ?? 0)} سین`
    case 'telegram-members':
      return `${formatFaNumber(order.telegramMemberOrder?.quantity ?? qty ?? 0)} ممبر`
    case 'chatgpt':
      return order.accountShopOrder?.planName ?? order.recipientName ?? null
    case 'virtual-number':
      return order.recipientName?.trim() || order.virtualNumber?.country || null
    default:
      return null
  }
}

function accountShopStatusLabel(
  status: NonNullable<ShopOrder['accountShopOrder']>['status'],
): string {
  if (status === 'delivered') return 'تحویل شده'
  if (status === 'processing') return 'در حال پردازش'
  return 'ثبت شده'
}

function paymentMethodText(order: ShopOrder): string {
  const wallet = Number(order.walletAmountToman)
  const gateway = Number(order.gatewayAmountToman)
  if (order.paymentMethod === 'zibal' && wallet > 0 && gateway > 0) {
    return 'کیف پول + درگاه بانکی'
  }
  return paymentMethodLabel(order.paymentMethod)
}

function tomanValue(amount: number): ReactNode {
  return (
    <>
      <span className="order-detail__unit">تومان</span>
      <span>{formatFaNumber(amount)}</span>
    </>
  )
}

function Cell({ cell, onCopy }: { cell: DetailCell; onCopy: (value: string) => void }) {
  const multiline =
    typeof cell.value === 'string' &&
    (cell.value.includes('\n') || cell.valueClassName === 'order-detail__value--multiline')

  return (
    <div className="order-detail__cell">
      <span className="order-detail__label">{cell.label}</span>
      <div className="order-detail__cell-value">
        <span
          className={`order-detail__value${cell.valueClassName ? ` ${cell.valueClassName}` : ''}${
            multiline ? ' order-detail__value--multiline' : ''
          }`}
          dir="auto"
        >
          {cell.value}
        </span>
        {cell.copyValue ? (
          <button
            type="button"
            className="order-detail__copy"
            aria-label={`کپی ${cell.label}`}
            onClick={() => onCopy(cell.copyValue!)}
          >
            <CopyIcon width={13} height={13} />
          </button>
        ) : null}
      </div>
    </div>
  )
}

function DetailCard({
  title,
  groups,
  onCopy,
  riseIndex,
}: {
  title: string
  groups: DetailGroup[]
  onCopy: (value: string) => void
  riseIndex: number
}) {
  const hasContent = groups.some((group) => group.cells.length > 0)
  if (!hasContent) return null

  return (
    <>
      <h3
        className="order-detail__section-title shop-rise"
        style={{ '--rise-index': riseIndex } as CSSProperties}
      >
        {title}
      </h3>
      <div
        className="order-detail__card shop-rise"
        style={{ '--rise-index': riseIndex + 1 } as CSSProperties}
      >
        {groups.map((group, groupIndex) =>
          group.cells.length === 0 ? null : (
            <div
              key={`${title}-${groupIndex}`}
              className={`order-detail__grid order-detail__grid--${group.cols}`}
            >
              {group.cells.map((cell) => (
                <Cell key={cell.label} cell={cell} onCopy={onCopy} />
              ))}
            </div>
          ),
        )}
      </div>
    </>
  )
}

export function OrderDetailPage() {
  const navigate = useNavigate()
  const { orderId: rawOrderId } = useParams()
  const orderId = rawOrderId ? decodeURIComponent(rawOrderId) : ''
  const { haptic } = useTelegram()
  const [order, setOrder] = useState<ShopOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  }>({ show: false, message: '', type: 'success' })

  const handleBack = useCallback(() => {
    navigate('/dashboard')
  }, [navigate])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (!orderId) {
        setLoading(false)
        setError('شماره سفارش نامعتبر است')
        return
      }

      setLoading(true)
      setError(null)

      try {
        const response = await fetchOrder(orderId)
        if (!cancelled) setOrder(response.order)
      } catch (err) {
        if (!cancelled) {
          setOrder(null)
          setError(err instanceof Error ? err.message : 'خطا در دریافت سفارش')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [orderId])

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

  const accountCategory = useMemo(() => {
    const categoryId = order?.accountShopOrder?.accountCategoryId
    if (!categoryId) return null
    return ACCOUNT_SHOP_CATEGORY_OPTIONS.find((item) => item.id === categoryId) ?? null
  }, [order])
  const categoryMeta = useMemo(
    () => (order ? shopCategories.find((item) => item.id === order.category.slug) : null),
    [order],
  )
  const CategoryIcon = categoryMeta?.icon
  const orderIconSrc = accountCategory?.stillImageSrc ?? accountCategory?.imageSrc ?? null
  const summary = order ? quantitySummary(order) : null
  const orderTitle =
    accountCategory?.label ?? order?.accountShopOrder?.planName ?? order?.category.label ?? ''

  const copyValue = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      haptic('light')
      setNotification({ show: true, message: 'کپی شد', type: 'success' })
    } catch {
      haptic('medium')
      setNotification({ show: true, message: 'کپی ناموفق بود', type: 'error' })
    }
  }

  const generalGroups: DetailGroup[] = order
    ? [
        {
          cols: 2,
          cells: [
            {
              label: 'مبلغ',
              value: tomanValue(Number(order.amountToman)),
              valueClassName: 'order-detail__value--amount',
            },
            {
              label: 'وضعیت',
              value: userOrderStatusLabel(order),
              valueClassName: statusValueClass(order),
            },
          ],
        },
        {
          cols: 2,
          cells: [
            {
              label: 'روش پرداخت',
              value: paymentMethodText(order),
            },
            {
              label: 'شماره سفارش',
              value: order.orderId,
              copyValue: order.orderId,
            },
          ],
        },
        {
          cols: 1,
          cells: order.fulfilledAt
            ? [{ label: 'تاریخ تکمیل', value: formatFaDateTimeLong(order.fulfilledAt) }]
            : [],
        },
        {
          cols: 2,
          cells:
            Number(order.walletAmountToman) > 0 && Number(order.gatewayAmountToman) > 0
              ? [
                  {
                    label: 'از کیف پول',
                    value: tomanValue(Number(order.walletAmountToman)),
                    valueClassName: 'order-detail__value--amount',
                  },
                  {
                    label: 'از درگاه',
                    value: tomanValue(Number(order.gatewayAmountToman)),
                    valueClassName: 'order-detail__value--amount',
                  },
                ]
              : [],
        },
        ...(order.accountShopOrder
          ? ([
              {
                cols: 2 as const,
                cells: [
                  {
                    label: 'محصول',
                    value: order.accountShopOrder.planName,
                  },
                  {
                    label: 'وضعیت تحویل',
                    value: accountShopStatusLabel(order.accountShopOrder.status),
                    valueClassName:
                      order.accountShopOrder.status === 'delivered'
                        ? 'order-detail__value--success'
                        : 'order-detail__value--pending',
                  },
                ],
              },
              {
                cols: 2 as const,
                cells: [
                  {
                    label: 'مدت',
                    value: order.accountShopOrder.durationLabel || '—',
                  },
                  {
                    label: 'گارانتی',
                    value: order.accountShopOrder.warrantyLabel || '—',
                  },
                ],
              },
              ...order.accountShopOrder.customFields
                .filter((field) => (order.accountShopOrder?.fieldValues[field.id] ?? '').trim())
                .map((field) => ({
                  cols: 1 as const,
                  cells: [
                    {
                      label: field.label,
                      value: order.accountShopOrder!.fieldValues[field.id],
                      copyValue: order.accountShopOrder!.fieldValues[field.id],
                    },
                  ],
                })),
            ] satisfies DetailGroup[])
          : []),
      ]
    : []

  const recipientGroups: DetailGroup[] = (() => {
    if (!order) return []
    // Account shop has no recipient; plan name is stored on recipientName for display elsewhere.
    if (order.category.slug === 'chatgpt') return []

    const cells: DetailCell[] = []
    if (order.recipientName) cells.push({ label: 'نام', value: order.recipientName })
    if (order.recipientUsername) {
      cells.push({
        label: 'یوزرنیم',
        value: `@${order.recipientUsername}`,
        copyValue: order.recipientUsername,
      })
    }
    if (
      summary &&
      (order.category.slug === 'telegram-stars' ||
        order.category.slug === 'telegram-premium' ||
        (!order.recipientName && !order.recipientUsername))
    ) {
      cells.push({ label: 'مقدار', value: summary })
    }

    if (cells.length === 0) return []
    if (cells.length === 1) return [{ cols: 1, cells }]
    if (cells.length === 3) return [{ cols: 3, cells }]
    return [{ cols: 2, cells }]
  })()

  const deliveryGroups: DetailGroup[] = (() => {
    if (!order?.accountShopOrder?.deliveryNote) return []
    return [
      {
        cols: 1,
        cells: [
          {
            label: 'متن تحویل',
            value: order.accountShopOrder.deliveryNote,
            copyValue: order.accountShopOrder.deliveryNote,
            valueClassName: 'order-detail__value--multiline',
          },
        ],
      },
    ]
  })()

  const productGroups: DetailGroup[] = (() => {
    if (!order) return []
    if (order.accountShopOrder) return []

    if (order.virtualNumber) {
      return [
        {
          cols: 1,
          cells: [
            {
              label: 'شماره',
              value: order.virtualNumber.number,
              copyValue: order.virtualNumber.number,
            },
          ],
        },
        {
          cols: 3,
          cells: [
            { label: 'کشور', value: order.virtualNumber.country },
            { label: 'سرویس', value: order.virtualNumber.service },
            { label: 'کیفیت', value: order.virtualNumber.quality },
          ],
        },
        {
          cols: order.virtualNumber.code ? 2 : 1,
          cells: [
            { label: 'بازه', value: order.virtualNumber.range },
            ...(order.virtualNumber.code
              ? [
                  {
                    label: 'کد',
                    value: order.virtualNumber.code,
                    copyValue: order.virtualNumber.code,
                  },
                ]
              : []),
          ],
        },
      ]
    }

    if (order.reactionOrder) {
      const itemRows: DetailGroup[] = order.reactionOrder.items.map((item, index) => ({
        cols: 2 as const,
        cells: [
          {
            label: 'آیتم',
            value: item.emoji || `آیتم ${formatFaNumber(index + 1)}`,
          },
          {
            label: 'تعداد',
            value: formatFaNumber(item.quantity),
          },
        ],
      }))

      return [
        {
          cols: 1,
          cells: [{ label: 'پست', value: order.reactionOrder.postTitle || '—' }],
        },
        {
          cols: 1,
          cells: [
            {
              label: 'لینک',
              value: order.reactionOrder.postLink,
              copyValue: order.reactionOrder.postLink,
            },
          ],
        },
        ...itemRows,
      ]
    }

    if (order.channelViewOrder) {
      return [
        {
          cols: 2,
          cells: [
            {
              label: 'آیتم',
              value: order.channelViewOrder.postTitle || '—',
            },
            {
              label: 'تعداد',
              value: formatFaNumber(order.channelViewOrder.quantity),
            },
          ],
        },
        {
          cols: 1,
          cells: [
            {
              label: 'لینک',
              value: order.channelViewOrder.postLink,
              copyValue: order.channelViewOrder.postLink,
            },
          ],
        },
      ]
    }

    if (order.telegramMemberOrder) {
      return [
        {
          cols: 2,
          cells: [
            {
              label: 'آیتم',
              value: order.telegramMemberOrder.channelTitle || '—',
            },
            {
              label: 'تعداد',
              value: formatFaNumber(order.telegramMemberOrder.quantity),
            },
          ],
        },
        {
          cols: order.telegramMemberOrder.channelUsername ? 2 : 1,
          cells: [
            ...(order.telegramMemberOrder.channelUsername
              ? [
                  {
                    label: 'یوزرنیم',
                    value: `@${order.telegramMemberOrder.channelUsername}`,
                  },
                ]
              : []),
            {
              label: 'لینک',
              value: order.telegramMemberOrder.channelLink,
              copyValue: order.telegramMemberOrder.channelLink,
            },
          ],
        },
      ]
    }

    return []
  })()

  return (
    <div className="order-detail">
      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title="جزئیات سفارش" onBack={handleBack} />
      </div>

      <div className="order-detail__content">
        {loading ? (
          <div className="order-detail__card shop-rise" style={{ '--rise-index': 1 } as CSSProperties}>
            <div className="order-detail__grid order-detail__grid--2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="order-detail__cell">
                  <span className="order-detail__skeleton" style={{ width: '40%' }} />
                  <span className="order-detail__skeleton" style={{ width: '70%' }} />
                </div>
              ))}
            </div>
          </div>
        ) : error || !order ? (
          <EmptyState
            className="shop-rise"
            style={{ '--rise-index': 1 } as CSSProperties}
            title={error ?? 'سفارش پیدا نشد'}
          />
        ) : (
          <>
            <div
              className="order-detail__summary shop-rise"
              style={{ '--rise-index': 1 } as CSSProperties}
            >
              <div
                className={`order-detail__summary-icon${orderIconSrc ? ' order-detail__summary-icon--image' : ''}`}
                style={{
                  background:
                    accountCategory?.gradient ?? categoryMeta?.gradient ?? 'var(--surface-elevated)',
                }}
              >
                {orderIconSrc ? (
                  <img src={orderIconSrc} alt="" width={40} height={40} />
                ) : CategoryIcon ? (
                  <CategoryIcon width={20} height={20} color={categoryMeta?.iconColor ?? '#fff'} />
                ) : (
                  <ShopIcon width={20} height={20} color="#fff" />
                )}
              </div>
              <div className="order-detail__summary-text">
                <div className="order-detail__summary-title">{orderTitle}</div>
                {summary ? <div className="order-detail__summary-meta">{summary}</div> : null}
              </div>
              <span className={`order-detail__status ${statusValueClass(order)}`}>
                {userOrderStatusLabel(order)}
              </span>
            </div>

            <DetailCard title="اطلاعات سفارش" groups={generalGroups} onCopy={copyValue} riseIndex={2} />
            <DetailCard title="گیرنده" groups={recipientGroups} onCopy={copyValue} riseIndex={4} />
            <DetailCard title="جزئیات محصول" groups={productGroups} onCopy={copyValue} riseIndex={6} />
            <DetailCard title="اطلاعات تحویل" groups={deliveryGroups} onCopy={copyValue} riseIndex={7} />

            <h3
              className="order-detail__section-title shop-rise"
              style={{ '--rise-index': 8 } as CSSProperties}
            >
              پشتیبانی
            </h3>
            <div
              className="order-detail__menu shop-rise"
              style={{ '--rise-index': 9 } as CSSProperties}
            >
              <button
                type="button"
                className="order-detail__menu-item order-detail__menu-item--accent"
                onClick={() => {
                  haptic('light')
                  navigate(
                    `/support/new?orderId=${encodeURIComponent(order.orderId)}&category=product`,
                  )
                }}
              >
                <span className="order-detail__menu-start">
                  <span className="order-detail__menu-icon">
                    <ContactIcon width={18} height={18} />
                  </span>
                  <span>ثبت تیکت درباره این سفارش</span>
                </span>
              </button>
            </div>
          </>
        )}
      </div>

      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification((prev) => ({ ...prev, show: false }))}
      />
    </div>
  )
}
