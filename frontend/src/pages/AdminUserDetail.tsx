import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ActionBottomSheet } from '../components/ActionBottomSheet'
import { EmptyState } from '../components/EmptyState'
import CopyIcon from '../components/icons/CopyIcon'
import { Notification } from '../components/Notification'
import { PageHeader } from '../components/PageHeader'
import { SolarIcon } from '../components/SolarIcon'
import { TransactionDetailSheet } from '../components/TransactionDetailSheet'
import { useAdminAccess } from '../hooks/useAdminAccess'
import { useTelegram } from '../hooks/useTelegram'
import { balanceToToman, formatUserDisplayName } from '../lib/api'
import { formatFaTraffic } from '../lib/formatTraffic'
import {
  fetchAdminUserDetail,
  patchAdminUserBalance,
  patchAdminUserBan,
  patchAdminUserPanelStatus,
  patchAdminUserRole,
  type AdminAuditLog,
  type AdminUserDetailUser,
  type AdminUserPanel,
} from '../lib/paymentsApi'
import { isTelegramWebApp } from '../lib/telegram'
import type { UserRole } from '../types/user'
import type { WalletTransaction } from '../types/wallet'
import '../styles/shop-rise.css'
import './Admin.css'
import './AdminUserDetail.css'

type DetailTab = 'panels' | 'transactions' | 'audit'

type AdminUserSheet =
  | { kind: 'ban' }
  | { kind: 'balance' }
  | { kind: 'role'; role: UserRole }
  | {
      kind: 'panel-status'
      panelId: string
      panelUsername: string
      status: AdminUserPanel['status']
    }

const DETAIL_TABS: Array<{
  id: DetailTab
  label: string
  icon: `solar:${string}`
}> = [
  { id: 'panels', label: 'پنل‌ها', icon: 'solar:server-square-bold-duotone' },
  { id: 'transactions', label: 'تراکنش‌ها', icon: 'solar:wallet-money-bold-duotone' },
  { id: 'audit', label: 'لاگ ادمین', icon: 'solar:clipboard-list-bold-duotone' },
]

function roleLabel(role: UserRole) {
  if (role === 'supervisor') return 'سوپروایزر'
  if (role === 'admin') return 'ادمین'
  return 'کاربر'
}

function panelServiceLabel(type: string) {
  if (type === 'panel_trial') return 'آزمایشی'
  if (type === 'panel_usage') return 'مصرفی'
  if (type === 'panel_reseller') return 'ریسلری'
  if (type === 'panel_unlimited') return 'نامحدود'
  if (type === 'outbound_volume') return 'اوتباند حجمی'
  if (type === 'outbound_usage') return 'اوتباند مصرفی'
  return type
}

function panelStatusLabel(status: AdminUserPanel['status']) {
  if (status === 'active') return 'فعال'
  if (status === 'suspended') return 'معلق'
  return 'غیرفعال'
}

const ROLE_OPTIONS: Array<{
  id: UserRole
  label: string
  icon: `solar:${string}`
}> = [
  { id: 'user', label: 'کاربر', icon: 'solar:user-linear' },
  { id: 'admin', label: 'ادمین', icon: 'solar:shield-user-linear' },
  { id: 'supervisor', label: 'سوپروایزر', icon: 'solar:crown-linear' },
]

const PANEL_STATUS_OPTIONS: Array<{
  id: AdminUserPanel['status']
  label: string
  icon: `solar:${string}`
}> = [
  { id: 'active', label: 'فعال', icon: 'solar:check-circle-linear' },
  { id: 'suspended', label: 'معلق', icon: 'solar:pause-circle-linear' },
  { id: 'deactivated', label: 'غیرفعال', icon: 'solar:close-circle-linear' },
]

function panelServiceIcon(serviceType: string): `solar:${string}` {
  if (serviceType === 'panel_trial') return 'solar:stars-minimalistic-bold-duotone'
  if (serviceType === 'panel_reseller') return 'solar:shop-2-bold-duotone'
  if (serviceType === 'panel_unlimited') return 'solar:infinity-bold-duotone'
  if (serviceType === 'outbound_volume') return 'solar:server-bold-duotone'
  if (serviceType === 'outbound_usage') return 'solar:chart-bold-duotone'
  return 'solar:server-square-bold-duotone'
}

function transactionIcon(tx: WalletTransaction): `solar:${string}` {
  if (tx.status === 'pending') return 'solar:clock-circle-bold-duotone'
  if (tx.status === 'failed') return 'solar:close-circle-bold-duotone'
  if (tx.type === 'transfer') {
    return tx.transferDirection === 'in'
      ? 'solar:arrow-down-bold-duotone'
      : 'solar:arrow-up-bold-duotone'
  }
  if (tx.paymentMethod === 'tron') return 'solar:dollar-minimalistic-bold-duotone'
  if (tx.paymentMethod === 'card') return 'solar:card-bold-duotone'
  if (tx.type === 'panel_usage') return 'solar:chart-2-bold-duotone'
  if (tx.type === 'purchase') return 'solar:cart-large-2-bold-duotone'
  if (tx.type === 'deposit' || tx.type === 'refund') return 'solar:wallet-money-bold-duotone'
  return 'solar:wallet-linear'
}

function transactionIconTone(tx: WalletTransaction) {
  if (tx.status === 'pending') return 'tx-pending'
  if (tx.status === 'failed') return 'tx-muted'
  if (tx.amount > 0) return 'tx-positive'
  if (tx.amount < 0) return 'tx-negative'
  return 'tx-neutral'
}

function auditActionIcon(action: string): `solar:${string}` {
  if (action === 'user.ban') return 'solar:user-block-bold-duotone'
  if (action === 'user.unban') return 'solar:user-check-bold-duotone'
  if (action === 'user.balance.set') return 'solar:wallet-money-bold-duotone'
  if (action === 'user.panel.status') return 'solar:server-square-bold-duotone'
  if (action === 'user.role.set') return 'solar:shield-user-bold-duotone'
  return 'solar:clipboard-list-bold-duotone'
}

type ItemIconTone =
  | 'panel-active'
  | 'panel-suspended'
  | 'panel-deactivated'
  | 'tx-positive'
  | 'tx-negative'
  | 'tx-pending'
  | 'tx-muted'
  | 'tx-neutral'
  | 'audit'

function ListItemIcon({ tone, children }: { tone: ItemIconTone; children: ReactNode }) {
  return (
    <span className={`admin-user-detail__item-icon admin-user-detail__item-icon--${tone}`}>
      {children}
    </span>
  )
}

function paymentMethodLabel(method: string | null) {
  if (method === 'wallet') return 'کیف پول'
  if (method === 'trial') return 'آزمایشی'
  if (method === 'legacy_import') return 'واردات قدیمی'
  if (method === 'card') return 'کارت'
  return method || '—'
}

function bytesToGb(bytes: string | null | undefined) {
  const value = Number(bytes ?? 0)
  if (!Number.isFinite(value) || value <= 0) return 0
  return value / 1024 ** 3
}

function actorLabel(log: AdminAuditLog) {
  if (log.actor.displayName?.trim()) return log.actor.displayName.trim()
  if (log.actor.username?.trim()) return `@${log.actor.username.trim()}`
  return String(log.actor.telegramId)
}

function auditActionLabel(action: string, meta: AdminAuditLog['meta']) {
  const formatAmount = (value: unknown) =>
    Number(value ?? 0).toLocaleString('fa-IR')

  switch (action) {
    case 'user.ban':
      return 'مسدود کردن کاربر'
    case 'user.unban':
      return 'رفع مسدودیت کاربر'
    case 'user.balance.set':
      return `تغییر موجودی (${formatAmount(meta?.previousBalance)} ← ${formatAmount(meta?.newBalance)} تومان)`
    case 'user.panel.status':
      return `پنل ${String(meta?.clientUsername ?? '—')} (${panelStatusLabel(String(meta?.previousStatus) as AdminUserPanel['status'])} ← ${panelStatusLabel(String(meta?.newStatus) as AdminUserPanel['status'])})`
    case 'user.role.set':
      return `تغییر نقش (${roleLabel(String(meta?.previousRole) as UserRole)} ← ${roleLabel(String(meta?.newRole) as UserRole)})`
    default:
      return action
  }
}

function formatTxAmount(amount: number, status: WalletTransaction['status']) {
  const abs = Math.abs(amount).toLocaleString('fa-IR')
  if (status === 'failed') return abs
  if (amount > 0) return `+${abs}`
  if (amount < 0) return `-${abs}`
  return abs
}

function txAmountClass(transaction: WalletTransaction) {
  if (transaction.status === 'failed') return 'is-muted'
  if (transaction.amount > 0) return 'is-positive'
  if (transaction.amount < 0) return 'is-negative'
  return ''
}

function AdminUserDetailSkeleton({ showRole }: { showRole: boolean }) {
  const tabsRise = showRole ? 5 : 4
  const panelRise = showRole ? 6 : 5

  return (
    <>
      <div className="admin-user-detail__body">
        <section
          className="admin-user-detail__profile admin-user-detail--skeleton shop-rise"
          style={{ '--rise-index': 1 } as CSSProperties}
          aria-hidden
        >
          <span className="admin-user-detail-skel admin-user-detail-skel--avatar" />
          <div className="admin-user-detail__profile-body">
            <div className="admin-user-detail__profile-top">
              <span className="admin-user-detail-skel admin-user-detail-skel--name" />
              <span className="admin-user-detail-skel admin-user-detail-skel--badge" />
            </div>
            <span className="admin-user-detail-skel admin-user-detail-skel--meta" />
          </div>
        </section>

        <div
          className="admin-user-detail__ops admin-user-detail--skeleton shop-rise"
          style={{ '--rise-index': 2 } as CSSProperties}
          aria-hidden
        >
          <span className="admin-user-detail-skel admin-user-detail-skel--op" />
          <span className="admin-user-detail-skel admin-user-detail-skel--op" />
        </div>

        <dl
          className="admin-user-detail__info admin-user-detail--skeleton shop-rise"
          style={{ '--rise-index': 3 } as CSSProperties}
          aria-hidden
        >
          {[1, 2, 3, 4].map((index) => (
            <div key={index}>
              <span className="admin-user-detail-skel admin-user-detail-skel--label" />
              <span className="admin-user-detail-skel admin-user-detail-skel--value" />
            </div>
          ))}
        </dl>

        {showRole ? (
          <div
            className="admin-user-detail__role-wrap admin-user-detail--skeleton shop-rise"
            style={{ '--rise-index': 4 } as CSSProperties}
            aria-hidden
          >
            <span className="admin-user-detail-skel admin-user-detail-skel--status-label" />
            <span className="admin-user-detail-skel admin-user-detail-skel--seg" />
          </div>
        ) : null}
      </div>

      <div
        className="admin-tabs admin-tabs--3 admin-user-detail--skeleton shop-rise"
        style={{ '--rise-index': tabsRise } as CSSProperties}
        aria-hidden
      >
        <span className="admin-user-detail-skel admin-user-detail-skel--tab" />
        <span className="admin-user-detail-skel admin-user-detail-skel--tab" />
        <span className="admin-user-detail-skel admin-user-detail-skel--tab" />
      </div>

      <div
        className="admin-user-detail__tab-panel shop-rise"
        style={{ '--rise-index': panelRise } as CSSProperties}
        aria-busy="true"
        aria-label="در حال بارگذاری"
      >
        <div className="admin-user-detail__panels">
          {[1, 2].map((index) => (
            <article
              key={index}
              className="admin-user-detail__panel admin-user-detail__panel--skeleton"
              aria-hidden
            >
              <div className="admin-user-detail__panel-toggle">
                <span className="admin-user-detail-skel admin-user-detail-skel--item-icon" />
                <div className="admin-user-detail__panel-summary">
                  <span className="admin-user-detail-skel admin-user-detail-skel--panel-name" />
                  <span className="admin-user-detail-skel admin-user-detail-skel--panel-meta" />
                </div>
                <span className="admin-user-detail-skel admin-user-detail-skel--chevron" />
              </div>
            </article>
          ))}
        </div>
      </div>
    </>
  )
}

function CopyField({
  label,
  value,
  onCopy,
  panelUsername,
}: {
  label: string
  value: string | null | undefined
  onCopy: (text: string, label: string) => void
  panelUsername?: boolean
}) {
  const text = value?.trim() || ''
  const empty = !text

  return (
    <div className="admin-user-detail__field">
      <span className="admin-user-detail__field-label">{label}</span>
      {empty ? (
        <span className="admin-user-detail__field-empty">—</span>
      ) : (
        <button
          type="button"
          className={`admin-user-detail__copy${panelUsername ? ' admin-user-detail__copy--username' : ''}`}
          onClick={() => onCopy(text, label)}
        >
          <span
            dir={panelUsername ? 'rtl' : 'ltr'}
            className={panelUsername ? 'admin-user-detail__panel-username' : undefined}
          >
            {text}
          </span>
          <CopyIcon width={12} height={12} color="currentColor" />
        </button>
      )}
    </div>
  )
}

function PanelCard({
  panel,
  expanded,
  saving,
  onToggle,
  onStatusRequest,
  onCopy,
}: {
  panel: AdminUserPanel
  expanded: boolean
  saving: boolean
  onToggle: () => void
  onStatusRequest: (status: AdminUserPanel['status']) => void
  onCopy: (text: string, label: string) => void
}) {
  return (
    <article className={`admin-user-detail__panel${expanded ? ' is-open' : ''}`}>
      <button type="button" className="admin-user-detail__panel-toggle" onClick={onToggle}>
        <ListItemIcon tone={`panel-${panel.status}`}>
          <SolarIcon icon={panelServiceIcon(panel.serviceType)} width={17} height={17} />
        </ListItemIcon>
        <div className="admin-user-detail__panel-summary">
          <strong className="admin-user-detail__panel-username">{panel.clientUsername}</strong>
          <span>
            {panelServiceLabel(panel.serviceType)}
            {' · '}
            {panelStatusLabel(panel.status)}
          </span>
        </div>
        <SolarIcon
          icon={expanded ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'}
          width={14}
          height={14}
          color="var(--text-muted)"
        />
      </button>

      {expanded ? (
        <div className="admin-user-detail__panel-body">
          <CopyField label="آدرس ورود" value={panel.panelUrl} onCopy={onCopy} />
          <div className="admin-user-detail__field-row">
            <CopyField
              label="نام کاربری"
              value={panel.clientUsername}
              panelUsername
              onCopy={onCopy}
            />
            <CopyField label="رمز عبور" value={panel.adminPassword} onCopy={onCopy} />
          </div>

          <dl className="admin-user-detail__meta-grid">
            <div>
              <dt>شناسه پنل</dt>
              <dd dir="ltr">{panel.panelId}</dd>
            </div>
            <div>
              <dt>شناسه ادمین</dt>
              <dd dir="ltr">{panel.panelAdminId || '—'}</dd>
            </div>
            <div>
              <dt>روش پرداخت</dt>
              <dd>{paymentMethodLabel(panel.paymentMethod)}</dd>
            </div>
            <div>
              <dt>موجودی پنل</dt>
              <dd>{panel.walletBalance.toLocaleString('fa-IR')} تومان</dd>
            </div>
            <div>
              <dt>ترافیک صورتحساب‌شده</dt>
              <dd>{formatFaTraffic(bytesToGb(panel.lastBilledTrafficBytes), 'long')}</dd>
            </div>
            <div>
              <dt>ترافیک پیش‌پرداخت</dt>
              <dd>{formatFaTraffic(bytesToGb(panel.prepaidTrafficBytes), 'long')}</dd>
            </div>
            <div>
              <dt>آخرین صورتحساب</dt>
              <dd>
                {panel.lastBilledAt
                  ? new Date(panel.lastBilledAt).toLocaleString('fa-IR', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '—'}
              </dd>
            </div>
            <div>
              <dt>تاریخ ایجاد</dt>
              <dd>
                {new Date(panel.createdAt).toLocaleDateString('fa-IR', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </dd>
            </div>
          </dl>

          <div className="admin-user-detail__status-wrap">
            <span className="admin-user-detail__status-label">وضعیت پنل</span>
            <div className="admin-user-detail__status-seg" role="group" aria-label="وضعیت پنل">
              {PANEL_STATUS_OPTIONS.map((option) => {
                const selected = panel.status === option.id
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={selected}
                    className={`admin-user-detail__status-seg-btn admin-user-detail__status-seg-btn--${option.id}${
                      selected ? ' is-active' : ''
                    }`}
                    disabled={saving}
                    onClick={() => onStatusRequest(option.id)}
                  >
                    <SolarIcon icon={option.icon} width={14} height={14} />
                    <span>{option.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      ) : null}
    </article>
  )
}

export function AdminUserDetailPage() {
  const navigate = useNavigate()
  const { telegramId } = useParams()
  const { ready, user: actor } = useAdminAccess()
  const { haptic } = useTelegram()

  const id = Number(telegramId)

  const [user, setUser] = useState<AdminUserDetailUser | null>(null)
  const [panels, setPanels] = useState<AdminUserPanel[]>([])
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([])
  const [tab, setTab] = useState<DetailTab>('panels')
  const [expandedPanelId, setExpandedPanelId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [sheet, setSheet] = useState<AdminUserSheet | null>(null)
  const [balanceInput, setBalanceInput] = useState('')
  const [balanceNote, setBalanceNote] = useState('')

  const [selectedTransaction, setSelectedTransaction] = useState<WalletTransaction | null>(null)
  const [detailSheetOpen, setDetailSheetOpen] = useState(false)

  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  }>({ show: false, message: '', type: 'info' })

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info') => {
    setNotification({ show: true, message, type })
  }

  const handleCopy = useCallback(
    async (text: string, label: string) => {
      try {
        await navigator.clipboard.writeText(text)
        haptic('light')
        showToast(`${label} کپی شد`, 'success')
      } catch {
        showToast('کپی ناموفق بود', 'error')
      }
    },
    [haptic],
  )

  const applyDetail = useCallback((detail: Awaited<ReturnType<typeof fetchAdminUserDetail>>) => {
    setUser(detail.user)
    setPanels(detail.panels)
    setTransactions(detail.transactions)
    setAuditLogs(detail.auditLogs)
    setBalanceInput(String(balanceToToman(detail.user.balance)))
    setExpandedPanelId((prev) => prev ?? detail.panels[0]?.id ?? null)
  }, [])

  const loadDetail = useCallback(async () => {
    if (!Number.isFinite(id) || id <= 0) return
    setLoading(true)
    try {
      applyDetail(await fetchAdminUserDetail(id))
      setError(null)
    } catch (err) {
      setUser(null)
      setError(err instanceof Error ? err.message : 'خطا در دریافت اطلاعات کاربر')
    } finally {
      setLoading(false)
    }
  }, [applyDetail, id])

  useEffect(() => {
    if (!ready || !Number.isFinite(id) || id <= 0) return
    void loadDetail()
  }, [ready, id, loadDetail])

  useEffect(() => {
    if (!isTelegramWebApp()) return
    const backButton = window.Telegram?.WebApp.BackButton
    if (!backButton) return
    const handleBack = () => navigate('/admin/users')
    backButton.show()
    backButton.onClick(handleBack)
    return () => {
      backButton.hide()
      backButton.offClick(handleBack)
    }
  }, [navigate])

  const closeSheet = useCallback(() => {
    if (saving) return
    setSheet(null)
  }, [saving])

  const refreshAfterMutation = useCallback(async () => {
    try {
      applyDetail(await fetchAdminUserDetail(id))
    } catch {
      // keep current state
    }
  }, [applyDetail, id])

  const executeBan = async () => {
    if (!user) return
    const next = !user.isBanned

    setSaving(true)
    try {
      const updated = await patchAdminUserBan(id, next)
      setUser((prev) => (prev ? { ...prev, ...updated } : prev))
      haptic('medium')
      showToast(next ? 'کاربر مسدود شد' : 'مسدودیت برداشته شد', 'success')
      setSheet(null)
      void refreshAfterMutation()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'خطا در تغییر وضعیت', 'error')
    } finally {
      setSaving(false)
    }
  }

  const executeBalanceSave = async () => {
    if (!user) return
    const amount = Number(balanceInput.replace(/[^\d]/g, ''))
    if (!Number.isFinite(amount) || amount < 0) {
      showToast('مبلغ نامعتبر است', 'warning')
      return
    }
    if (amount === balanceToToman(user.balance)) {
      setSheet(null)
      return
    }

    setSaving(true)
    try {
      const result = await patchAdminUserBalance(id, amount, balanceNote)
      setUser((prev) => (prev ? { ...prev, ...result.user } : prev))
      setBalanceInput(String(result.newBalance))
      haptic('medium')
      showToast('موجودی به‌روز شد', 'success')
      setSheet(null)
      setBalanceNote('')
      void refreshAfterMutation()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'خطا در ذخیره موجودی', 'error')
    } finally {
      setSaving(false)
    }
  }

  const executePanelStatus = async () => {
    if (!sheet || sheet.kind !== 'panel-status') return

    setSaving(true)
    try {
      const updated = await patchAdminUserPanelStatus(id, sheet.panelId, sheet.status)
      setPanels((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      haptic('medium')
      showToast('وضعیت پنل به‌روز شد', 'success')
      setSheet(null)
      void refreshAfterMutation()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'خطا در تغییر وضعیت پنل', 'error')
    } finally {
      setSaving(false)
    }
  }

  const requestPanelStatus = (panel: AdminUserPanel, status: AdminUserPanel['status']) => {
    if (panel.status === status) return
    haptic('light')
    setSheet({
      kind: 'panel-status',
      panelId: panel.id,
      panelUsername: panel.clientUsername,
      status,
    })
  }

  const requestRoleChange = (role: UserRole) => {
    if (!user || user.role === role) return
    haptic('light')
    setSheet({ kind: 'role', role })
  }

  const executeRoleChange = async () => {
    if (!sheet || sheet.kind !== 'role' || !user) return

    setSaving(true)
    try {
      const result = await patchAdminUserRole(id, sheet.role)
      setUser((prev) =>
        prev
          ? {
              ...prev,
              ...result.user,
              panelAdminPassword: prev.panelAdminPassword,
            }
          : prev,
      )
      haptic('medium')
      showToast('نقش کاربر به‌روز شد', 'success')
      setSheet(null)
      void refreshAfterMutation()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'خطا در تغییر نقش', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!ready) return null

  const displayName = user ? formatUserDisplayName(user) : 'کاربر'
  const banNext = user ? !user.isBanned : false
  const canEditRole = Boolean(
    actor?.isSupervisor && user && actor.telegramId !== user.telegramId,
  )

  return (
    <div className="admin-section admin-user-detail">
      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification((prev) => ({ ...prev, show: false }))}
      />

      <TransactionDetailSheet
        isOpen={detailSheetOpen}
        transaction={selectedTransaction}
        onClose={() => setDetailSheetOpen(false)}
      />

      <ActionBottomSheet
        isOpen={sheet?.kind === 'ban'}
        onClose={closeSheet}
        title={banNext ? 'مسدود کردن کاربر' : 'رفع مسدودیت'}
        description={
          banNext
            ? 'کاربر دیگر نمی‌تواند وارد مینی‌اپ شود. این عمل در لاگ ادمین ثبت می‌شود.'
            : 'دسترسی کاربر به مینی‌اپ دوباره فعال می‌شود.'
        }
        confirmLabel={saving ? 'در حال انجام…' : banNext ? 'مسدود کردن' : 'رفع مسدودیت'}
        confirmVariant={banNext ? 'danger' : 'success'}
        busy={saving}
        onConfirm={() => void executeBan()}
      />

      <ActionBottomSheet
        isOpen={sheet?.kind === 'balance'}
        onClose={closeSheet}
        title="تغییر موجودی"
        description={
          user
            ? `موجودی فعلی: ${balanceToToman(user.balance).toLocaleString('fa-IR')} تومان`
            : undefined
        }
        confirmLabel={saving ? 'در حال ذخیره…' : 'ذخیره موجودی'}
        confirmVariant="primary"
        busy={saving}
        confirmDisabled={!balanceInput}
        onConfirm={() => void executeBalanceSave()}
      >
        <div className="admin-modal-field">
          <label htmlFor="admin-balance-input">موجودی جدید (تومان)</label>
          <input
            id="admin-balance-input"
            value={balanceInput}
            onChange={(event) => setBalanceInput(event.target.value.replace(/[^\d]/g, ''))}
            inputMode="numeric"
            dir="ltr"
            disabled={saving}
          />
        </div>
        <div className="admin-modal-field">
          <label htmlFor="admin-balance-note">یادداشت (اختیاری)</label>
          <input
            id="admin-balance-note"
            value={balanceNote}
            onChange={(event) => setBalanceNote(event.target.value)}
            placeholder="دلیل تغییر موجودی"
            disabled={saving}
          />
        </div>
      </ActionBottomSheet>

      <ActionBottomSheet
        isOpen={sheet?.kind === 'role'}
        onClose={closeSheet}
        title="تغییر نقش کاربر"
        description={
          sheet?.kind === 'role' && user
            ? `نقش «${displayName}» از «${roleLabel(user.role)}» به «${roleLabel(sheet.role)}» تغییر کند؟`
            : undefined
        }
        confirmLabel={saving ? 'در حال انجام…' : 'تأیید تغییر نقش'}
        confirmVariant="primary"
        busy={saving}
        onConfirm={() => void executeRoleChange()}
      />

      <ActionBottomSheet
        isOpen={sheet?.kind === 'panel-status'}
        onClose={closeSheet}
        title="تغییر وضعیت پنل"
        description={
          sheet?.kind === 'panel-status'
            ? `پنل «${sheet.panelUsername}» به وضعیت «${panelStatusLabel(sheet.status)}» تغییر کند؟`
            : undefined
        }
        confirmLabel={saving ? 'در حال انجام…' : 'تأیید تغییر'}
        confirmVariant="primary"
        busy={saving}
        onConfirm={() => void executePanelStatus()}
      />

      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title="جزئیات کاربر" onBack={() => navigate('/admin/users')} />
      </div>

      {loading ? (
        <AdminUserDetailSkeleton showRole={Boolean(actor?.isSupervisor)} />
      ) : null}

      {!loading && error ? (
        <div className="admin-user-detail__body">
          <p className="admin-status admin-status--error">{error}</p>
        </div>
      ) : null}

      {!loading && user ? (
        <div className="admin-user-detail__body">
            <section
              className={`admin-user-detail__profile shop-rise admin-user-detail__profile--${user.role}${
                user.isBanned ? ' admin-user-detail__profile--banned' : ''
              }`}
              style={{ '--rise-index': 1 } as CSSProperties}
            >
              <span className="admin-user-detail__avatar" aria-hidden>
                {(displayName.slice(0, 1) || 'ک').toUpperCase()}
              </span>
              <div className="admin-user-detail__profile-body">
                <div className="admin-user-detail__profile-top">
                  <h2>{displayName}</h2>
                  <span
                    className={`admin-user-item__badge admin-user-item__badge--${
                      user.isBanned ? 'banned' : user.role
                    }`}
                  >
                    {user.isBanned ? 'مسدود' : roleLabel(user.role)}
                  </span>
                </div>
                <p className="admin-user-detail__profile-meta">
                  {user.username ? (
                    <span dir="ltr">@{user.username}</span>
                  ) : null}
                  {user.username ? <span aria-hidden> · </span> : null}
                  <span dir="ltr">{user.telegramId}</span>
                  <span aria-hidden> · </span>
                  <span>{balanceToToman(user.balance).toLocaleString('fa-IR')} تومان</span>
                </p>
              </div>
            </section>

            <div
              className="admin-user-detail__ops shop-rise"
              style={{ '--rise-index': 2 } as CSSProperties}
            >
              <button
                type="button"
                className={`admin-user-detail__op${user.isBanned ? ' admin-user-detail__op--teal' : ' admin-user-detail__op--danger'}`}
                disabled={saving}
                onClick={() => {
                  haptic('light')
                  setSheet({ kind: 'ban' })
                }}
              >
                {user.isBanned ? 'رفع مسدودیت' : 'مسدود کردن'}
              </button>
              <button
                type="button"
                className="admin-user-detail__op admin-user-detail__op--accent"
                disabled={saving}
                onClick={() => {
                  haptic('light')
                  setBalanceInput(String(balanceToToman(user.balance)))
                  setBalanceNote('')
                  setSheet({ kind: 'balance' })
                }}
              >
                تغییر موجودی
              </button>
            </div>

            <dl
              className="admin-user-detail__info shop-rise"
              style={{ '--rise-index': 3 } as CSSProperties}
            >
              <div>
                <dt>نام کامل</dt>
                <dd>{user.realName || '—'}</dd>
              </div>
              <div>
                <dt>ایمیل</dt>
                <dd>{user.email || '—'}</dd>
              </div>
              <div>
                <dt>رمز مشترک پنل</dt>
                <dd>
                  {user.panelAdminPassword ? (
                    <button
                      type="button"
                      className="admin-user-detail__inline-copy"
                      onClick={() => void handleCopy(user.panelAdminPassword!, 'رمز مشترک پنل')}
                    >
                      <span dir="ltr">{user.panelAdminPassword}</span>
                      <CopyIcon width={12} height={12} color="currentColor" />
                    </button>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              <div>
                <dt>عضویت</dt>
                <dd>
                  {user.createdAt
                    ? new Date(user.createdAt).toLocaleDateString('fa-IR')
                    : '—'}
                </dd>
              </div>
            </dl>

            {canEditRole ? (
              <div
                className="admin-user-detail__role-wrap shop-rise"
                style={{ '--rise-index': 4 } as CSSProperties}
              >
                <span className="admin-user-detail__status-label">نقش کاربر</span>
                <div className="admin-user-detail__status-seg" role="group" aria-label="نقش کاربر">
                  {ROLE_OPTIONS.map((option) => {
                    const selected = user.role === option.id
                    return (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={selected}
                        className={`admin-user-detail__status-seg-btn admin-user-detail__status-seg-btn--role-${option.id}${
                          selected ? ' is-active' : ''
                        }`}
                        disabled={saving}
                        onClick={() => requestRoleChange(option.id)}
                      >
                        <SolarIcon icon={option.icon} width={14} height={14} />
                        <span>{option.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}
        </div>
      ) : null}

      {!loading && user ? (
        <>
          <div
            className="admin-tabs admin-tabs--3 shop-rise"
            style={{ '--rise-index': canEditRole ? 5 : 4 } as CSSProperties}
            role="tablist"
          >
            {DETAIL_TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                className={`admin-tabs__btn${tab === item.id ? ' admin-tabs__btn--active' : ''}`}
                onClick={() => {
                  haptic('light')
                  setTab(item.id)
                }}
              >
                <SolarIcon icon={item.icon} width={15} height={15} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          <div
            className="admin-user-detail__tab-panel shop-rise"
            style={{ '--rise-index': 5 } as CSSProperties}
          >
              {tab === 'panels' ? (
                panels.length === 0 ? (
                  <EmptyState title="پنلی ثبت نشده" />
                ) : (
                  <div className="admin-user-detail__panels">
                    {panels.map((panel) => (
                      <PanelCard
                        key={panel.id}
                        panel={panel}
                        expanded={expandedPanelId === panel.id}
                        saving={saving}
                        onToggle={() => {
                          haptic('light')
                          setExpandedPanelId((prev) => (prev === panel.id ? null : panel.id))
                        }}
                        onStatusRequest={(status) => requestPanelStatus(panel, status)}
                        onCopy={(text, label) => void handleCopy(text, label)}
                      />
                    ))}
                  </div>
                )
              ) : null}

              {tab === 'transactions' ? (
                transactions.length === 0 ? (
                  <EmptyState title="تراکنشی ثبت نشده" />
                ) : (
                  <ul className="admin-user-detail__tx-list">
                    {transactions.map((tx) => (
                      <li key={tx.id}>
                        <button
                          type="button"
                          className="admin-user-detail__tx"
                          onClick={() => {
                            haptic('light')
                            setSelectedTransaction(tx)
                            setDetailSheetOpen(true)
                          }}
                        >
                          <div className="admin-user-detail__tx-start">
                            <ListItemIcon tone={transactionIconTone(tx)}>
                              <SolarIcon icon={transactionIcon(tx)} width={16} height={16} />
                            </ListItemIcon>
                            <div className="admin-user-detail__tx-body">
                              <strong>{tx.title}</strong>
                              <span>{tx.date}</span>
                            </div>
                          </div>
                          <span className={`admin-user-detail__tx-amount ${txAmountClass(tx)}`}>
                            {formatTxAmount(tx.amount, tx.status)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )
              ) : null}

              {tab === 'audit' ? (
                auditLogs.length === 0 ? (
                  <EmptyState title="لاگی ثبت نشده" />
                ) : (
                  <ul className="admin-user-detail__audit-list">
                    {auditLogs.map((log) => (
                      <li key={log.id} className="admin-user-detail__audit">
                        <ListItemIcon tone="audit">
                          <SolarIcon icon={auditActionIcon(log.action)} width={16} height={16} />
                        </ListItemIcon>
                        <div className="admin-user-detail__audit-body">
                          <div className="admin-user-detail__audit-head">
                            <strong>{auditActionLabel(log.action, log.meta)}</strong>
                            <time dateTime={log.createdAt}>
                              {new Date(log.createdAt).toLocaleString('fa-IR', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </time>
                          </div>
                          <p>
                            {actorLabel(log)}
                            {log.meta?.note ? ` · ${String(log.meta.note)}` : ''}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )
              ) : null}
          </div>
        </>
      ) : null}
    </div>
  )
}
