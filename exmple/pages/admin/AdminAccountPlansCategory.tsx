import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { EmptyState } from '../../components/EmptyState'
import EditIcon from '../../components/icons/EditIcon'
import TrashIcon from '../../components/icons/TrashIcon'
import { ACCOUNT_SHOP_CATEGORY_OPTIONS } from '../../data/accountShopCategories'
import { isAccountShopCategoryId } from '../../data/accountShopProducts'
import { useAdminAccess } from '../../hooks/useAdminAccess'
import { useTelegram } from '../../hooks/useTelegram'
import {
  deleteAdminAccountPlan,
  fetchAdminAccountPlans,
  updateAdminAccountPlan,
  type AdminAccountShopPlan,
} from '../../lib/adminApi'
import { formatTomanPrice } from '../../lib/formatStars'
import { AdminScreen } from './AdminScreen'
import '../../styles/shop-rise.css'
import './AdminAccountPlans.css'

function noticeLabel(kind: AdminAccountShopPlan['noticeKind']) {
  if (kind === 'info') return 'اطلاعات'
  if (kind === 'warning') return 'هشدار'
  if (kind === 'note') return 'نکته'
  return null
}

export function AdminAccountPlansCategoryPage() {
  const navigate = useNavigate()
  const { categoryId: categoryIdParam } = useParams<{ categoryId: string }>()
  const { haptic } = useTelegram()
  const { ready, allowed } = useAdminAccess()
  const categoryId =
    categoryIdParam && isAccountShopCategoryId(categoryIdParam) ? categoryIdParam : null
  const category =
    ACCOUNT_SHOP_CATEGORY_OPTIONS.find((item) => item.id === categoryId) ?? null

  const [items, setItems] = useState<AdminAccountShopPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  }>({ show: false, message: '', type: 'error' })

  const handleBack = useCallback(
    () => navigate('/admin/account-plans', { replace: true }),
    [navigate],
  )

  const load = useCallback(async () => {
    if (!categoryId) return
    setLoading(true)
    try {
      const result = await fetchAdminAccountPlans(categoryId)
      setItems(result.items)
    } catch (error) {
      setNotification({
        show: true,
        message: error instanceof Error ? error.message : 'خطا در دریافت پلن‌ها',
        type: 'error',
      })
    } finally {
      setLoading(false)
    }
  }, [categoryId])

  useEffect(() => {
    if (!categoryId) {
      navigate('/admin/account-plans', { replace: true })
      return
    }
    if (!ready || !allowed) return
    void load()
  }, [allowed, categoryId, load, navigate, ready])

  if (!ready || !allowed || !categoryId || !category) return null

  return (
    <AdminScreen
      sticky
      title={category.label}
      eyebrow="پلن‌های اکانت"
      onBack={handleBack}
      meta={
        <button
          type="button"
          className="admin-account-plans__add-btn"
          onClick={() => {
            haptic('light')
            navigate(`/admin/account-plans/${categoryId}/new`)
          }}
        >
          افزودن پلن
        </button>
      }
      notification={notification}
      onCloseNotification={() => setNotification((prev) => ({ ...prev, show: false }))}
    >
      {loading ? (
        <p className="admin__muted" style={{ paddingInline: 'var(--page-padding-x)' }}>
          در حال بارگذاری…
        </p>
      ) : items.length === 0 ? (
        <EmptyState
          title="پلنی ثبت نشده"
          description="با افزودن پلن، محصول تأمین‌کننده را به فروشگاه وصل کنید."
          action={
            <button
              type="button"
              className="admin-account-plans__add-btn"
              onClick={() => navigate(`/admin/account-plans/${categoryId}/new`)}
            >
              افزودن پلن
            </button>
          }
        />
      ) : (
        <div className="admin-account-plans__list shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
          {items.map((plan) => {
            const notice = noticeLabel(plan.noticeKind)
            return (
              <article
                key={plan.id}
                className={`admin-account-plans__row${plan.isActive ? '' : ' is-inactive'}`}
              >
                <div className="admin-account-plans__row-top">
                  <div className="admin-account-plans__row-main">
                    <strong>{plan.name}</strong>
                    <div className="admin-account-plans__row-tags">
                      <span className="admin-account-plans__tag">{plan.durationLabel}</span>
                      <span className="admin-account-plans__tag">{plan.warrantyLabel}</span>
                      <span className="admin-account-plans__tag is-price">
                        {plan.pricingMode === 'fixed'
                          ? `${formatTomanPrice(plan.fixedToman ?? 0)} ت`
                          : `متغیر · ${plan.markupPercent.toLocaleString('fa-IR')}٪`}
                      </span>
                      {notice ? (
                        <span className="admin-account-plans__tag">{notice}</span>
                      ) : null}
                      {plan.customFields.length > 0 ? (
                        <span className="admin-account-plans__tag">
                          {plan.customFields.length.toLocaleString('fa-IR')} فیلد
                        </span>
                      ) : null}
                    </div>
                    <span className="admin-account-plans__row-meta" dir="ltr">
                      {plan.roboticvnVariantTitle}
                    </span>
                  </div>
                </div>
                {plan.noticeKind !== 'none' && plan.noticeText ? (
                  <div className={`aap-notice aap-notice--${plan.noticeKind}`}>
                    <strong>{notice}</strong>
                    <p>{plan.noticeText}</p>
                  </div>
                ) : null}
                <div className="admin-account-plans__row-actions">
                  <button
                    type="button"
                    className="admin-account-plans__status"
                    disabled={busyId === plan.id}
                    onClick={() => {
                      haptic('light')
                      navigate(`/admin/account-plans/${categoryId}/edit/${plan.id}`)
                    }}
                  >
                    <EditIcon width={14} height={14} />
                    ویرایش
                  </button>
                  <button
                    type="button"
                    className={`admin-account-plans__status${plan.isActive ? ' is-on' : ''}`}
                    disabled={busyId === plan.id}
                    onClick={() => {
                      void (async () => {
                        setBusyId(plan.id)
                        try {
                          await updateAdminAccountPlan(plan.id, { isActive: !plan.isActive })
                          await load()
                        } catch (error) {
                          setNotification({
                            show: true,
                            message: error instanceof Error ? error.message : 'عملیات ناموفق',
                            type: 'error',
                          })
                        } finally {
                          setBusyId(null)
                        }
                      })()
                    }}
                  >
                    {plan.isActive ? 'فعال' : 'خاموش'}
                  </button>
                  <button
                    type="button"
                    className="admin-icon-btn is-danger"
                    disabled={busyId === plan.id}
                    aria-label="حذف"
                    onClick={() => {
                      if (!window.confirm(`پلن «${plan.name}» حذف شود؟`)) return
                      void (async () => {
                        setBusyId(plan.id)
                        try {
                          await deleteAdminAccountPlan(plan.id)
                          await load()
                          setNotification({
                            show: true,
                            message: 'پلن حذف شد',
                            type: 'success',
                          })
                        } catch (error) {
                          setNotification({
                            show: true,
                            message: error instanceof Error ? error.message : 'حذف ناموفق',
                            type: 'error',
                          })
                        } finally {
                          setBusyId(null)
                        }
                      })()
                    }}
                  >
                    <TrashIcon width={15} height={15} />
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </AdminScreen>
  )
}
