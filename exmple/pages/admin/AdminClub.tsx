import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '../../components/EmptyState'
import { useAdminAccess } from '../../hooks/useAdminAccess'
import { useTelegram } from '../../hooks/useTelegram'
import {
  createAdminClubReward,
  deleteAdminClubReward,
  fetchAdminClubRewards,
  syncAllClubPoints,
  updateAdminClubReward,
  type AdminClubReward,
} from '../../lib/adminApi'
import { clubRewardTypeLabel, formatFaNumber } from './adminLabels'
import { AdminScreen } from './AdminScreen'

const REWARD_TYPES: Array<{ value: AdminClubReward['rewardType']; label: string }> = [
  { value: 'percent_discount', label: 'تخفیف درصدی' },
  { value: 'fixed_discount', label: 'تخفیف مبلغی' },
  { value: 'free_item', label: 'آیتم رایگان' },
  { value: 'custom', label: 'سفارشی' },
]

export function AdminClubPage() {
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const { ready, allowed } = useAdminAccess()
  const [items, setItems] = useState<AdminClubReward[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [pointsCost, setPointsCost] = useState('100')
  const [rewardType, setRewardType] =
    useState<AdminClubReward['rewardType']>('percent_discount')
  const [rewardValue, setRewardValue] = useState('10')
  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  }>({ show: false, message: '', type: 'error' })

  const handleBack = useCallback(() => navigate('/admin', { replace: true }), [navigate])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetchAdminClubRewards()
      setItems(result.items)
    } catch (error) {
      setNotification({
        show: true,
        message: error instanceof Error ? error.message : 'خطا در دریافت جوایز',
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

  const handleSync = async () => {
    if (!window.confirm('همگام‌سازی امتیاز همه کاربران انجام شود؟')) return
    setSyncing(true)
    try {
      const result = await syncAllClubPoints()
      haptic('medium')
      setNotification({
        show: true,
        message: `همگام‌سازی انجام شد · ${formatFaNumber(result.updated)} کاربر`,
        type: 'success',
      })
    } catch (error) {
      setNotification({
        show: true,
        message: error instanceof Error ? error.message : 'خطا در همگام‌سازی',
        type: 'error',
      })
    } finally {
      setSyncing(false)
    }
  }

  const handleCreate = async () => {
    if (!title.trim() || !description.trim()) {
      setNotification({ show: true, message: 'عنوان و توضیح را وارد کنید', type: 'warning' })
      return
    }
    setSaving(true)
    try {
      await createAdminClubReward({
        title: title.trim(),
        description: description.trim(),
        pointsCost: Number(pointsCost) || 1,
        rewardType,
        rewardValue: rewardValue.trim(),
        isActive: true,
      })
      haptic('medium')
      setTitle('')
      setDescription('')
      setRewardValue('10')
      setNotification({ show: true, message: 'جایزه افزوده شد', type: 'success' })
      await load()
    } catch (error) {
      setNotification({
        show: true,
        message: error instanceof Error ? error.message : 'خطا در ثبت جایزه',
        type: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  if (!ready || !allowed) return null

  return (
    <AdminScreen
      title="کلاب و جوایز"
      eyebrow="بازار"
      onBack={handleBack}
      notification={notification}
      onCloseNotification={() => setNotification((prev) => ({ ...prev, show: false }))}
    >
      <section className="admin__card">
        <p className="admin__muted" style={{ margin: 0, lineHeight: 1.7 }}>
          به ازای هر <strong>۱۰۰٬۰۰۰ تومان</strong> خرید موفق،{' '}
          <strong>۱۰ امتیاز کلاب</strong> داده می‌شود. جوایز زیر را برای تبدیل امتیاز تعریف کنید.
        </p>
        <div className="admin__actions" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="admin__btn"
            disabled={syncing}
            onClick={() => void handleSync()}
          >
            {syncing ? 'در حال همگام‌سازی…' : 'همگام‌سازی امتیاز کاربران'}
          </button>
        </div>
      </section>

      <h5 className="admin__menu-title">تعریف جایزه جدید</h5>
      <section className="admin__card">
        <label className="admin__field">
          <span className="admin__field-label">عنوان</span>
          <input
            className="admin__input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="مثلاً تخفیف ۱۰٪ سفارش بعد"
          />
        </label>
        <label className="admin__field">
          <span className="admin__field-label">توضیح</span>
          <input
            className="admin__input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="کاربر با امتیاز چه می‌گیرد؟"
          />
        </label>
        <label className="admin__field">
          <span className="admin__field-label">هزینه امتیاز</span>
          <input
            className="admin__input"
            value={pointsCost}
            onChange={(e) => setPointsCost(e.target.value.replace(/[^\d]/g, ''))}
            inputMode="numeric"
          />
        </label>
        <div className="admin__filters" style={{ marginBottom: 10 }}>
          {REWARD_TYPES.map((item) => (
            <button
              key={item.value}
              type="button"
              className={`admin__chip${rewardType === item.value ? ' admin__chip--active' : ''}`}
              onClick={() => setRewardType(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <label className="admin__field">
          <span className="admin__field-label">مقدار جایزه</span>
          <input
            className="admin__input"
            value={rewardValue}
            onChange={(e) => setRewardValue(e.target.value)}
            placeholder="مثلاً ۱۰ برای ۱۰٪ یا نام آیتم رایگان"
          />
        </label>
        <button
          type="button"
          className="admin__btn"
          disabled={saving}
          onClick={() => void handleCreate()}
        >
          {saving ? 'در حال ثبت…' : 'افزودن جایزه'}
        </button>
      </section>

      <h5 className="admin__menu-title">جوایز فعال</h5>
      {loading ? (
        <p className="admin__muted">در حال بارگذاری…</p>
      ) : items.length === 0 ? (
        <EmptyState title="هنوز جایزه‌ای تعریف نشده" />
      ) : (
        <ul className="admin__list">
          {items.map((reward) => (
            <li key={reward.id}>
              <div className="admin__row" style={{ cursor: 'default' }}>
                <div className="admin__row-top">
                  <span className="admin__row-title">{reward.title}</span>
                  <span
                    className={
                      reward.isActive
                        ? 'admin__badge admin__badge--success'
                        : 'admin__badge'
                    }
                  >
                    {reward.isActive ? 'فعال' : 'غیرفعال'}
                  </span>
                </div>
                <div className="admin__row-meta">
                  {clubRewardTypeLabel(reward.rewardType)} · مقدار {reward.rewardValue} ·{' '}
                  {formatFaNumber(reward.pointsCost)} امتیاز
                </div>
                <div className="admin__row-meta">{reward.description}</div>
                <div className="admin__actions" style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="admin__pager-btn"
                    onClick={() =>
                      void updateAdminClubReward(reward.id, {
                        isActive: !reward.isActive,
                      }).then(load)
                    }
                  >
                    {reward.isActive ? 'غیرفعال کردن' : 'فعال کردن'}
                  </button>
                  <button
                    type="button"
                    className="admin__pager-btn"
                    onClick={() => {
                      if (!window.confirm('حذف این جایزه؟')) return
                      void deleteAdminClubReward(reward.id).then(load)
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
