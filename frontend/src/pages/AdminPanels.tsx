import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import EditIcon from '../components/icons/EditIcon'
import LockIcon from '../components/icons/LockIcon'
import ServerStack02Icon from '../components/icons/server-stack-02-stroke-rounded'
import TrashIcon from '../components/icons/TrashIcon'
import { Notification } from '../components/Notification'
import { PageHeader } from '../components/PageHeader'
import { useAdminAccess } from '../hooks/useAdminAccess'
import { useTelegram } from '../hooks/useTelegram'
import {
  createAdminPanel,
  deleteAdminPanel,
  fetchAdminPanels,
  reorderAdminPanels,
  toggleAdminPanelFlag,
  updateAdminPanel,
  type PanelToggleKind,
  type PasarGuardPanel,
} from '../lib/adminPanelsApi'
import '../styles/shop-rise.css'
import './Admin.css'
import './AdminPanels.css'

type ViewMode = 'list' | 'add' | 'edit'

function formatFaNumber(value: number) {
  return Math.trunc(Number(value) || 0).toLocaleString('fa-IR')
}

function formatBytes(bytes: number) {
  if (!bytes) return '۰ B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
  return `${(bytes / k ** i).toFixed(2)} ${sizes[i]}`
}

function connectionStatus(panel: PasarGuardPanel) {
  if (!panel.connection) {
    return { text: 'در حال بررسی…', className: 'admin-panels__status--pending' }
  }
  if (panel.connection.ok) {
    return { text: 'متصل', className: 'admin-panels__status--ok' }
  }
  return { text: 'قطع اتصال', className: 'admin-panels__status--fail' }
}

const EDIT_TOGGLES: Array<{ kind: PanelToggleKind; label: string }> = [
  { kind: 'sales', label: 'فروش' },
  { kind: 'renewal', label: 'تمدید' },
  { kind: 'outboundVolume', label: 'اوتباند حجمی' },
  { kind: 'outboundUsage', label: 'اوتباند مصرفی' },
  { kind: 'panelVolume', label: 'پنل حجمی' },
  { kind: 'panelUsage', label: 'پنل مصرفی' },
  { kind: 'panelUnlimited', label: 'پنل نامحدود' },
]

export function AdminPanelsPage() {
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const { ready, allowed } = useAdminAccess()

  const [view, setView] = useState<ViewMode>('list')
  const [items, setItems] = useState<PasarGuardPanel[]>([])
  const [editingPanel, setEditingPanel] = useState<PasarGuardPanel | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [busyPanelId, setBusyPanelId] = useState<string | null>(null)
  const [reordering, setReordering] = useState(false)

  const [formName, setFormName] = useState('')
  const [formPanelUrl, setFormPanelUrl] = useState('')
  const [formUsername, setFormUsername] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formRemark, setFormRemark] = useState('')
  const [formSubUrl, setFormSubUrl] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  }>({ show: false, message: '', type: 'error' })

  const resetForm = () => {
    setFormName('')
    setFormPanelUrl('')
    setFormUsername('')
    setFormPassword('')
    setFormRemark('')
    setFormSubUrl('')
    setFormError(null)
    setEditingPanel(null)
  }

  const handleBack = useCallback(() => {
    if (view === 'add' || view === 'edit') {
      setView('list')
      resetForm()
      return
    }
    navigate('/admin', { replace: true })
  }, [navigate, view])

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchAdminPanels({ connection: true, stats: true })
      setItems(data.items)
    } catch (error) {
      setNotification({
        show: true,
        message: error instanceof Error ? error.message : 'خطا در دریافت پنل‌ها',
        type: 'error',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!ready || !allowed) return
    if (view === 'list') void loadList()
  }, [allowed, loadList, ready, view])

  const openEdit = (panel: PasarGuardPanel) => {
    haptic('light')
    setEditingPanel(panel)
    setFormName(panel.name)
    setFormPanelUrl(panel.panelUrl)
    setFormUsername(panel.adminUsername)
    setFormPassword('')
    setFormRemark(panel.remark || '')
    setFormSubUrl(panel.subPublicBaseUrl || '')
    setFormError(null)
    setView('edit')
  }

  const movePanel = async (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= items.length) return

    const reordered = [...items]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(nextIndex, 0, moved)

    const order = reordered.map((panel, priority) => ({ id: panel.id, priority }))
    setReordering(true)
    try {
      const updated = await reorderAdminPanels(order)
      setItems(updated)
      haptic('light')
    } catch (error) {
      setNotification({
        show: true,
        message: error instanceof Error ? error.message : 'خطا در تغییر اولویت',
        type: 'error',
      })
    } finally {
      setReordering(false)
    }
  }

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault()
    setFormError(null)
    setBusy(true)
    try {
      const panel = await createAdminPanel({
        name: formName.trim(),
        panelUrl: formPanelUrl.trim(),
        adminUsername: formUsername.trim(),
        adminPassword: formPassword,
        remark: formRemark.trim() || undefined,
        subPublicBaseUrl: formSubUrl.trim() || undefined,
      })
      haptic('light')
      setNotification({
        show: true,
        message: `پنل «${panel.name}» با موفقیت اضافه شد`,
        type: 'success',
      })
      resetForm()
      setView('list')
      await loadList()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'خطا در افزودن پنل')
    } finally {
      setBusy(false)
    }
  }

  const handleUpdate = async (event: FormEvent) => {
    event.preventDefault()
    if (!editingPanel) return
    setFormError(null)
    setBusy(true)
    try {
      await updateAdminPanel(editingPanel.id, {
        name: formName.trim(),
        panelUrl: formPanelUrl.trim(),
        adminUsername: formUsername.trim(),
        ...(formPassword ? { adminPassword: formPassword } : {}),
        remark: formRemark.trim() || undefined,
        subPublicBaseUrl: formSubUrl.trim() || undefined,
      })
      haptic('light')
      setNotification({
        show: true,
        message: 'پنل با موفقیت به‌روزرسانی شد',
        type: 'success',
      })
      resetForm()
      setView('list')
      await loadList()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'خطا در ویرایش پنل')
    } finally {
      setBusy(false)
    }
  }

  const handleListToggleActive = async (panel: PasarGuardPanel) => {
    setBusyPanelId(panel.id)
    try {
      const updated = await toggleAdminPanelFlag(panel.id, 'active')
      setItems((prev) => prev.map((item) => (item.id === panel.id ? { ...item, ...updated } : item)))
      haptic('light')
    } catch (error) {
      setNotification({
        show: true,
        message: error instanceof Error ? error.message : 'خطا در تغییر وضعیت',
        type: 'error',
      })
    } finally {
      setBusyPanelId(null)
    }
  }

  const handleListDelete = async (panel: PasarGuardPanel) => {
    const confirmed = window.confirm(`پنل «${panel.name}» حذف شود؟`)
    if (!confirmed) return

    setBusyPanelId(panel.id)
    try {
      await deleteAdminPanel(panel.id)
      haptic('light')
      setItems((prev) => prev.filter((item) => item.id !== panel.id))
    } catch (error) {
      setNotification({
        show: true,
        message: error instanceof Error ? error.message : 'خطا در حذف پنل',
        type: 'error',
      })
    } finally {
      setBusyPanelId(null)
    }
  }

  const handleEditToggle = async (kind: PanelToggleKind) => {
    if (!editingPanel) return
    setBusy(true)
    try {
      const updated = await toggleAdminPanelFlag(editingPanel.id, kind)
      setEditingPanel(updated)
      haptic('light')
    } catch (error) {
      setNotification({
        show: true,
        message: error instanceof Error ? error.message : 'خطا در تغییر تنظیم',
        type: 'error',
      })
    } finally {
      setBusy(false)
    }
  }

  if (!ready || !allowed) return null

  const headerTitle =
    view === 'add' ? 'افزودن پنل' : view === 'edit' ? 'ویرایش پنل' : 'پنل‌های پاسارگارد'

  const headerAction =
    view === 'list' ? (
      <button
        type="button"
        className="page-header__action page-header__action--accent"
        onClick={() => {
          haptic('light')
          resetForm()
          setView('add')
        }}
      >
        افزودن پنل
      </button>
    ) : null

  return (
    <div className="admin admin-page admin-panels">
      <PageHeader title={headerTitle} onBack={handleBack} action={headerAction} />

      {view === 'list' ? (
        <>
          <p className="admin-panels__intro shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
            وضعیت اتصال، آمار زنده و اولویت هر پنل را در یک نگاه ببینید.
          </p>

          <div className="admin-panels__list shop-rise" style={{ '--rise-index': 1 } as CSSProperties}>
            {loading ? (
              <p className="admin-panels__empty">در حال بارگذاری…</p>
            ) : items.length === 0 ? (
              <p className="admin-panels__empty">هنوز پنلی ثبت نشده است.</p>
            ) : (
              items.map((panel, index) => {
                const status = connectionStatus(panel)
                const rowBusy = busyPanelId === panel.id
                const stats = panel.stats

                return (
                  <div key={panel.id} className={`admin-panels__row${!panel.isActive ? ' is-off' : ''}`}>
                    <div className="admin-panels__row-priority">
                      <button
                        type="button"
                        className="admin-panels__prio-btn"
                        disabled={index === 0 || reordering}
                        onClick={() => void movePanel(index, -1)}
                        aria-label="بالا"
                      >
                        ↑
                      </button>
                      <span className="admin-panels__prio-num">{formatFaNumber(panel.priority)}</span>
                      <button
                        type="button"
                        className="admin-panels__prio-btn"
                        disabled={index === items.length - 1 || reordering}
                        onClick={() => void movePanel(index, 1)}
                        aria-label="پایین"
                      >
                        ↓
                      </button>
                    </div>

                    <article className="admin-panels__card">
                      <div className="admin-panels__card-head">
                        <div className="admin-panels__card-title-wrap">
                          <span className="admin-panels__card-icon">
                            <ServerStack02Icon width={16} height={16} color="currentColor" />
                          </span>
                          <div className="admin-panels__card-title-copy">
                            <strong className="admin-panels__card-title">{panel.name}</strong>
                            <span className={`admin-panels__status ${status.className}`}>
                              {status.text}
                            </span>
                          </div>
                        </div>

                        <div className="admin-panels__row-actions">
                          <button
                            type="button"
                            className={`admin-icon-btn${panel.isActive ? ' is-on' : ' is-off'}`}
                            disabled={rowBusy}
                            aria-label={panel.isActive ? 'غیرفعال کردن پنل' : 'فعال کردن پنل'}
                            onClick={() => void handleListToggleActive(panel)}
                          >
                            <LockIcon width={15} height={15} locked={panel.isActive} />
                          </button>
                          <button
                            type="button"
                            className="admin-icon-btn"
                            disabled={rowBusy}
                            aria-label="ویرایش پنل"
                            onClick={() => openEdit(panel)}
                          >
                            <EditIcon width={15} height={15} />
                          </button>
                          <button
                            type="button"
                            className="admin-icon-btn is-danger"
                            disabled={rowBusy}
                            aria-label="حذف پنل"
                            onClick={() => void handleListDelete(panel)}
                          >
                            <TrashIcon width={15} height={15} />
                          </button>
                        </div>
                      </div>

                      <div className="admin-panels__card-stats">
                        <div className="admin-panels__mini-stat">
                          <strong>{stats ? formatFaNumber(stats.totalUsers) : '—'}</strong>
                          <span>کاربر</span>
                        </div>
                        <div className="admin-panels__mini-stat">
                          <strong>{stats ? formatFaNumber(stats.onlineUsers) : '—'}</strong>
                          <span>آنلاین</span>
                        </div>
                        <div className="admin-panels__mini-stat">
                          <strong>{stats ? formatBytes(stats.totalTraffic) : '—'}</strong>
                          <span>ترافیک</span>
                        </div>
                        <div className="admin-panels__mini-stat">
                          <strong>
                            {stats?.cpuCores != null ? formatFaNumber(stats.cpuCores) : '—'}
                          </strong>
                          <span>هسته CPU</span>
                        </div>
                      </div>

                      <div className="admin-panels__card-foot">
                        <span className="admin-panels__card-host" dir="ltr">
                          {panel.host}:{panel.port}
                        </span>
                        {stats?.version ? (
                          <span className="admin-panels__card-version" dir="ltr">
                            v{stats.version}
                          </span>
                        ) : null}
                        {!panel.connection?.ok && panel.connection?.error ? (
                          <span className="admin-panels__card-error">{panel.connection.error}</span>
                        ) : null}
                      </div>
                    </article>
                  </div>
                )
              })
            )}
          </div>
        </>
      ) : null}

      {view === 'add' || view === 'edit' ? (
        <form
          className="admin-panels__form shop-rise"
          style={{ '--rise-index': 0 } as CSSProperties}
          onSubmit={(event) => void (view === 'add' ? handleCreate(event) : handleUpdate(event))}
        >
          <label className="admin-panels__field">
            <span>نام پنل</span>
            <input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="مثلاً Marzban اصلی"
              required
            />
          </label>
          <label className="admin-panels__field">
            <span>آدرس پنل</span>
            <input
              value={formPanelUrl}
              onChange={(e) => setFormPanelUrl(e.target.value)}
              placeholder="https://panel.example.com"
              dir="ltr"
              required
            />
          </label>
          <label className="admin-panels__field">
            <span>نام کاربری ادمین</span>
            <input
              value={formUsername}
              onChange={(e) => setFormUsername(e.target.value)}
              dir="ltr"
              required
            />
          </label>
          <label className="admin-panels__field">
            <span>{view === 'edit' ? 'رمز عبور جدید (اختیاری)' : 'رمز عبور ادمین'}</span>
            <input
              type="password"
              value={formPassword}
              onChange={(e) => setFormPassword(e.target.value)}
              dir="ltr"
              required={view === 'add'}
            />
          </label>
          <label className="admin-panels__field">
            <span>پیشوند ساب (اختیاری)</span>
            <input
              value={formRemark}
              onChange={(e) => setFormRemark(e.target.value)}
              placeholder="برای نام‌گذاری ساب‌ها"
            />
          </label>
          <label className="admin-panels__field">
            <span>آدرس عمومی ساب (اختیاری)</span>
            <input
              value={formSubUrl}
              onChange={(e) => setFormSubUrl(e.target.value)}
              placeholder="https://sub.example.com"
              dir="ltr"
            />
          </label>

          {view === 'edit' && editingPanel ? (
            <div className="admin-panels__edit-toggles">
              <span className="admin-panels__edit-toggles-label">تنظیمات سرویس</span>
              <div className="admin-panels__toggles">
                {EDIT_TOGGLES.map((item) => {
                  const fieldMap: Record<PanelToggleKind, keyof PasarGuardPanel> = {
                    active: 'isActive',
                    sales: 'salesEnabled',
                    renewal: 'renewalEnabled',
                    outboundVolume: 'outboundVolumeEnabled',
                    outboundUsage: 'outboundUsageEnabled',
                    panelVolume: 'panelVolumeEnabled',
                    panelUsage: 'panelUsageEnabled',
                    panelUnlimited: 'panelUnlimitedEnabled',
                  }
                  const on = Boolean(editingPanel[fieldMap[item.kind]])
                  return (
                    <button
                      key={item.kind}
                      type="button"
                      className={`admin-panels__toggle${on ? ' is-on' : ''}`}
                      disabled={busy}
                      onClick={() => void handleEditToggle(item.kind)}
                    >
                      {item.label}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          {formError ? <p className="admin-panels__error">{formError}</p> : null}

          <button type="submit" className="admin-panels__submit" disabled={busy}>
            {busy
              ? view === 'add'
                ? 'در حال اتصال و ثبت…'
                : 'در حال ذخیره…'
              : view === 'add'
                ? 'افزودن و تست اتصال'
                : 'ذخیره تغییرات'}
          </button>
        </form>
      ) : null}

      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification((prev) => ({ ...prev, show: false }))}
      />
    </div>
  )
}
