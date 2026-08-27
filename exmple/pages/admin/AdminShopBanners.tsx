import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '../../components/EmptyState'
import TrashIcon from '../../components/icons/TrashIcon'
import ViewIcon from '../../components/icons/ViewIcon'
import { useAdminAccess } from '../../hooks/useAdminAccess'
import { useTelegram } from '../../hooks/useTelegram'
import {
  deleteAdminShopBanner,
  fetchAdminShopBanners,
  updateAdminShopBanner,
  type AdminShopBanner,
} from '../../lib/adminApi'
import { shopCategories } from '../../data/shopCategories'
import { accountShopProductLabel } from '../../data/accountShopProducts'
import { clearLocalShopBanners, resolveShopBannerImageUrl } from '../../lib/shopBanners'
import { AdminScreen } from './AdminScreen'
import '../../styles/shop-rise.css'
import './AdminShopBanners.css'

function productLabel(productKey: string) {
  return (
    shopCategories.find((item) => item.id === productKey)?.label ??
    accountShopProductLabel(productKey) ??
    productKey
  )
}

export function AdminShopBannersPage() {
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const { ready, allowed } = useAdminAccess()
  const [items, setItems] = useState<AdminShopBanner[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  }>({ show: false, message: '', type: 'error' })

  const handleBack = useCallback(() => navigate('/admin', { replace: true }), [navigate])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetchAdminShopBanners()
      setItems(result.items)
    } catch (error) {
      setNotification({
        show: true,
        message: error instanceof Error ? error.message : 'خطا در دریافت بنرها',
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

  const handleToggleActive = async (item: AdminShopBanner) => {
    if (busyId != null) return
    const next = !item.isActive
    haptic('light')
    setBusyId(item.id)
    try {
      await updateAdminShopBanner(item.id, { isActive: next })
      clearLocalShopBanners()
      await load()
      setNotification({
        show: true,
        message: next ? 'بنر فعال شد' : 'بنر غیرفعال شد',
        type: next ? 'success' : 'info',
      })
    } catch (error) {
      setNotification({
        show: true,
        message: error instanceof Error ? error.message : 'عملیات ناموفق بود',
        type: 'error',
      })
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (item: AdminShopBanner) => {
    if (busyId != null) return
    if (!window.confirm(`بنر «${item.title}» حذف شود؟`)) return
    haptic('medium')
    setBusyId(item.id)
    try {
      await deleteAdminShopBanner(item.id)
      clearLocalShopBanners()
      await load()
      setNotification({ show: true, message: 'بنر حذف شد', type: 'success' })
    } catch (error) {
      setNotification({
        show: true,
        message: error instanceof Error ? error.message : 'حذف ناموفق بود',
        type: 'error',
      })
    } finally {
      setBusyId(null)
    }
  }

  if (!ready || !allowed) return null

  return (
    <AdminScreen
      sticky
      title="بنر فروشگاه"
      eyebrow="بازار"
      onBack={handleBack}
      notification={notification}
      onCloseNotification={() => setNotification((prev) => ({ ...prev, show: false }))}
      meta={
        <button
          type="button"
          className="admin-shop-banners__add-btn"
          onClick={() => {
            haptic('light')
            navigate('/admin/shop-banners/new')
          }}
        >
          افزودن
        </button>
      }
    >
      <p className="admin-shop-banners__intro">
        بنرهای فعال در صفحه فروشگاه به‌صورت چرخشی نمایش داده می‌شوند. تصویر اصلی برای بنر بزرگ و
        تامبنیل برای بنرهای کناری استفاده می‌شود.
      </p>

      {loading ? (
        <p className="admin__muted" style={{ paddingInline: 'var(--page-padding-x)' }}>
          در حال بارگذاری…
        </p>
      ) : items.length === 0 ? (
        <EmptyState
          className="shop-rise"
          style={{ '--rise-index': 0 } as CSSProperties}
          title="بنری ثبت نشده"
          description="برای شروع، اولین بنر فروشگاه را بسازید."
          action={
            <button
              type="button"
              className="admin-shop-banners__empty-btn"
              onClick={() => {
                haptic('light')
                navigate('/admin/shop-banners/new')
              }}
            >
              افزودن بنر
            </button>
          }
        />
      ) : (
        <div className="admin-shop-banners__list shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
          {items.map((item) => {
            const busy = busyId === item.id
            return (
              <article
                key={item.id}
                className={`admin-shop-banners__row${item.isActive ? '' : ' is-inactive'}`}
              >
                <div className="admin-shop-banners__media" aria-hidden="true">
                  <img
                    src={resolveShopBannerImageUrl(item.mainImageUrl)}
                    alt=""
                    className="admin-shop-banners__media-main"
                  />
                  <img
                    src={resolveShopBannerImageUrl(item.thumbImageUrl)}
                    alt=""
                    className="admin-shop-banners__media-thumb"
                  />
                </div>

                <div className="admin-shop-banners__row-main">
                  <strong className="admin-shop-banners__row-title">{item.title}</strong>
                  <span className="admin-shop-banners__row-meta">
                    {productLabel(item.productKey)}
                    <span className="admin-shop-banners__dot" aria-hidden="true" />
                    {item.isActive ? 'فعال در فروشگاه' : 'غیرفعال'}
                  </span>
                </div>

                <div className="admin-shop-banners__row-actions">
                  <button
                    type="button"
                    className={`admin-icon-btn${item.isActive ? ' is-on' : ' is-off'}`}
                    disabled={busy}
                    aria-label={item.isActive ? 'غیرفعال کردن بنر' : 'فعال کردن بنر'}
                    onClick={() => void handleToggleActive(item)}
                  >
                    <ViewIcon width={15} height={15} />
                  </button>
                  <button
                    type="button"
                    className="admin-icon-btn is-danger"
                    disabled={busy}
                    aria-label="حذف بنر"
                    onClick={() => void handleDelete(item)}
                  >
                    <TrashIcon width={15} height={15} />
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
      <div style={{ height: 20 }} />
    </AdminScreen>
  )
}
