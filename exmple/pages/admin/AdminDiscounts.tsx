import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '../../components/EmptyState'
import { useAdminAccess } from '../../hooks/useAdminAccess'
import { useTelegram } from '../../hooks/useTelegram'
import {
  createAdminDiscount,
  deleteAdminDiscount,
  fetchAdminDiscounts,
  updateAdminDiscount,
  type AdminDiscount,
} from '../../lib/adminApi'
import { discountTypeLabel, formatFaDateLong, formatFaNumber } from './adminLabels'
import { AdminScreen } from './AdminScreen'

export function AdminDiscountsPage() {
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const { ready, allowed } = useAdminAccess()
  const [items, setItems] = useState<AdminDiscount[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent')
  const [discountValue, setDiscountValue] = useState('10')
  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  }>({ show: false, message: '', type: 'error' })

  const handleBack = useCallback(() => navigate('/admin', { replace: true }), [navigate])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetchAdminDiscounts()
      setItems(result.items)
    } catch (error) {
      setNotification({
        show: true,
        message: error instanceof Error ? error.message : 'خطا در دریافت تخفیف‌ها',
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

  const handleCreate = async () => {
    if (!code.trim() || !title.trim()) {
      setNotification({ show: true, message: 'کد و عنوان را وارد کنید', type: 'warning' })
      return
    }
    setSaving(true)
    try {
      await createAdminDiscount({
        code: code.trim(),
        title: title.trim(),
        discountType,
        discountValue: Number(discountValue) || 1,
        isActive: true,
      })
      haptic('medium')
      setCode('')
      setTitle('')
      setNotification({ show: true, message: 'تخفیف ثبت شد', type: 'success' })
      await load()
    } catch (error) {
      setNotification({
        show: true,
        message: error instanceof Error ? error.message : 'خطا در ثبت تخفیف',
        type: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  if (!ready || !allowed) return null

  return (
    <AdminScreen
      title="تخفیف‌ها"
      eyebrow="بازار"
      onBack={handleBack}
      notification={notification}
      onCloseNotification={() => setNotification((prev) => ({ ...prev, show: false }))}
    >
      <section className="admin__card">
        <label className="admin__field">
          <span className="admin__field-label">کد تخفیف</span>
          <input
            className="admin__input"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="مثلاً NOWROOZ10"
            dir="ltr"
          />
        </label>
        <label className="admin__field">
          <span className="admin__field-label">عنوان</span>
          <input
            className="admin__input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="تخفیف نوروزی ۱۰٪"
          />
        </label>
        <div className="admin__filters" style={{ marginBottom: 10 }}>
          <button
            type="button"
            className={`admin__chip${discountType === 'percent' ? ' admin__chip--active' : ''}`}
            onClick={() => setDiscountType('percent')}
          >
            درصدی
          </button>
          <button
            type="button"
            className={`admin__chip${discountType === 'fixed' ? ' admin__chip--active' : ''}`}
            onClick={() => setDiscountType('fixed')}
          >
            مبلغ ثابت
          </button>
        </div>
        <label className="admin__field">
          <span className="admin__field-label">
            {discountType === 'percent' ? 'درصد تخفیف' : 'مبلغ تخفیف (تومان)'}
          </span>
          <input
            className="admin__input"
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value.replace(/[^\d]/g, ''))}
            inputMode="numeric"
          />
        </label>
        <button
          type="button"
          className="admin__btn"
          disabled={saving}
          onClick={() => void handleCreate()}
        >
          {saving ? 'در حال ثبت…' : 'افزودن تخفیف'}
        </button>
      </section>

      <h5 className="admin__menu-title">تخفیف‌های ثبت‌شده</h5>
      {loading ? (
        <p className="admin__muted">در حال بارگذاری…</p>
      ) : items.length === 0 ? (
        <EmptyState title="تخفیفی ثبت نشده" />
      ) : (
        <ul className="admin__list">
          {items.map((item) => (
            <li key={item.id}>
              <div className="admin__row" style={{ cursor: 'default' }}>
                <div className="admin__row-top">
                  <span className="admin__row-title">{item.title}</span>
                  <span
                    className={
                      item.isActive
                        ? 'admin__badge admin__badge--success'
                        : 'admin__badge'
                    }
                  >
                    {item.isActive ? 'فعال' : 'غیرفعال'}
                  </span>
                </div>
                <div className="admin__row-meta">
                  کد {item.code} · {discountTypeLabel(item.discountType)}{' '}
                  {formatFaNumber(item.discountValue)}
                  {item.discountType === 'percent' ? '٪' : ' تومان'} · مصرف{' '}
                  {formatFaNumber(item.usedCount)}
                  {item.maxUses != null ? ` از ${formatFaNumber(item.maxUses)}` : ''}
                </div>
                <div className="admin__row-meta">
                  ثبت‌شده در {formatFaDateLong(item.createdAt)}
                </div>
                <div className="admin__actions" style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="admin__pager-btn"
                    onClick={() =>
                      void updateAdminDiscount(item.id, {
                        isActive: !item.isActive,
                      }).then(load)
                    }
                  >
                    {item.isActive ? 'غیرفعال' : 'فعال'}
                  </button>
                  <button
                    type="button"
                    className="admin__pager-btn"
                    onClick={() => {
                      if (!window.confirm('حذف این تخفیف؟')) return
                      void deleteAdminDiscount(item.id).then(load)
                    }}
                  >
                    حذف
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div style={{ height: 20 }} />
    </AdminScreen>
  )
}
