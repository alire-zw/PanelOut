import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { ImageViewer } from '../components/ImageViewer'
import { Notification } from '../components/Notification'
import { PageHeader } from '../components/PageHeader'
import { SolarIcon } from '../components/SolarIcon'
import { useAdminAccess } from '../hooks/useAdminAccess'
import { useTelegram } from '../hooks/useTelegram'
import { lockAppScroll, unlockAppScroll } from '../lib/scrollLock'
import {
  approveAdminCharge,
  formatCardNumberDisplay,
  rejectAdminCharge,
  resolveUploadUrl,
} from '../lib/paymentsApi'
import {
  fetchAdminChargesPayload,
  readLocalAdminCharges,
  syncAdminCharges,
  writeLocalAdminCharges,
  type AdminChargesPayload,
} from '../lib/adminCharges'
import { isTelegramWebApp } from '../lib/telegram'
import type { CardChargeRequest, CardChargeStatus } from '../types/payments'
import '../styles/shop-rise.css'
import './Admin.css'

const TABS: Array<{
  id: CardChargeStatus | 'all'
  label: string
  icon: `solar:${string}`
}> = [
  { id: 'pending', label: 'در انتظار', icon: 'solar:alarm-bold-duotone' },
  { id: 'approved', label: 'تأیید شده', icon: 'solar:bill-check-bold-duotone' },
  { id: 'rejected', label: 'رد شده', icon: 'solar:bill-cross-bold-duotone' },
  { id: 'all', label: 'همه', icon: 'solar:bill-list-bold-duotone' },
]

function userLabel(charge: CardChargeRequest) {
  const user = charge.user
  if (!user) return `کاربر ${charge.telegramUserId}`
  if (user.realName) return user.realName
  if (user.telegramName) return user.telegramName
  if (user.username) return `@${user.username}`
  return `کاربر ${user.telegramId}`
}

function userIdentity(charge: CardChargeRequest) {
  const telegramId = charge.user?.telegramId ?? charge.telegramUserId
  const username = charge.user?.username ? `@${charge.user.username}` : null
  return { telegramId, username }
}

function ChargeItemSkeleton({ index }: { index: number }) {
  return (
    <article
      className="admin-charge-item admin-charge-item--skeleton shop-rise"
      style={{ '--rise-index': Math.min(index + 2, 8) } as CSSProperties}
      aria-hidden
    >
      <div className="admin-charge-item__header">
        <span className="admin-charge-skel admin-charge-skel--thumb" />
        <div className="admin-charge-item__summary">
          <div className="admin-charge-item__title-row">
            <span className="admin-charge-skel admin-charge-skel--user" />
            <span className="admin-charge-skel admin-charge-skel--badge" />
          </div>
          <span className="admin-charge-skel admin-charge-skel--amount" />
        </div>
      </div>
      <div className="admin-charge-item__meta">
        <span className="admin-charge-item__meta-chip admin-charge-item__meta-chip--skel">
          <span className="admin-charge-skel admin-charge-skel--line" />
        </span>
        <span className="admin-charge-item__meta-chip admin-charge-item__meta-chip--skel">
          <span className="admin-charge-skel admin-charge-skel--line admin-charge-skel--line-sm" />
        </span>
        <span className="admin-charge-item__meta-chip admin-charge-item__meta-chip--skel">
          <span className="admin-charge-skel admin-charge-skel--line" />
        </span>
        <span className="admin-charge-item__meta-chip admin-charge-item__meta-chip--skel">
          <span className="admin-charge-skel admin-charge-skel--line admin-charge-skel--line-md" />
        </span>
      </div>
      <div className="admin-charge-item__actions">
        <span className="admin-charge-skel admin-charge-skel--btn" />
        <span className="admin-charge-skel admin-charge-skel--btn" />
      </div>
    </article>
  )
}

function RejectReasonModal({
  isOpen,
  note,
  busy,
  onNoteChange,
  onClose,
  onConfirm,
}: {
  isOpen: boolean
  note: string
  busy: boolean
  onNoteChange: (value: string) => void
  onClose: () => void
  onConfirm: () => void
}) {
  useEffect(() => {
    if (!isOpen) return
    lockAppScroll()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      unlockAppScroll()
    }
  }, [busy, isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div className="admin-reject" role="dialog" aria-modal="true" aria-labelledby="admin-reject-title">
      <button
        type="button"
        className="admin-reject__backdrop"
        onClick={() => {
          if (!busy) onClose()
        }}
      />
      <div className="admin-reject__panel">
        <h2 id="admin-reject-title" className="admin-reject__title">
          رد درخواست شارژ
        </h2>
        <p className="admin-reject__desc">دلیل رد را بنویسید (اختیاری). کاربر این متن را می‌بیند.</p>
        <textarea
          className="admin-reject__input"
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder="مثلاً مبلغ رسید با مبلغ درخواستی مطابقت ندارد"
          rows={4}
          maxLength={300}
          disabled={busy}
        />
        <div className="admin-reject__actions">
          <button type="button" className="admin-reject__btn" disabled={busy} onClick={onClose}>
            انصراف
          </button>
          <button
            type="button"
            className="admin-reject__btn admin-reject__btn--danger"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? 'در حال رد...' : 'رد درخواست'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function AdminChargesPage() {
  const navigate = useNavigate()
  const { ready } = useAdminAccess()
  const { haptic } = useTelegram()
  const [tab, setTab] = useState<CardChargeStatus | 'all'>('pending')
  const [charges, setCharges] = useState<CardChargeRequest[]>([])
  const [version, setVersion] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [viewerSrc, setViewerSrc] = useState<string | null>(null)
  const [rejectId, setRejectId] = useState<number | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  }>({ show: false, message: '', type: 'success' })

  const showNotification = (
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'success',
  ) => setNotification({ show: true, message, type })

  const applyPayload = useCallback((payload: AdminChargesPayload) => {
    setCharges(payload.charges)
    setVersion(payload.version)
    writeLocalAdminCharges(payload)
  }, [])

  const refreshInBackground = useCallback(
    async (status: CardChargeStatus | 'all', currentVersion?: string | null) => {
      try {
        const syncResult = await syncAdminCharges(status, currentVersion)
        if (syncResult.changed) {
          applyPayload(syncResult)
        } else if (syncResult.version) {
          setVersion(syncResult.version)
        }
      } catch {
        // background sync should not block the page
      }
    },
    [applyPayload],
  )

  const load = useCallback(async () => {
    const localCache = readLocalAdminCharges(tab)
    if (localCache) {
      applyPayload(localCache)
      setLoading(false)
      void refreshInBackground(tab, localCache.version)
      return
    }

    setLoading(true)
    setCharges([])
    setVersion(null)
    try {
      const payload = await fetchAdminChargesPayload(tab)
      applyPayload(payload)
      void refreshInBackground(tab, payload.version)
    } catch (error) {
      showNotification(error instanceof Error ? error.message : 'خطا در دریافت درخواست‌ها', 'error')
    } finally {
      setLoading(false)
    }
  }, [applyPayload, refreshInBackground, tab])

  const reloadAfterMutation = useCallback(async () => {
    try {
      const syncResult = await syncAdminCharges(tab, version)
      if (syncResult.changed) {
        applyPayload(syncResult)
      } else {
        const payload = await fetchAdminChargesPayload(tab)
        applyPayload(payload)
      }
    } catch (error) {
      showNotification(error instanceof Error ? error.message : 'خطا در بروزرسانی لیست', 'error')
    }
  }, [applyPayload, tab, version])

  useEffect(() => {
    if (!ready) return
    void load()
  }, [ready, load])

  useEffect(() => {
    if (!isTelegramWebApp()) return
    const backButton = window.Telegram?.WebApp.BackButton
    if (!backButton) return
    const handleBack = () => navigate('/admin')
    backButton.show()
    backButton.onClick(handleBack)
    return () => {
      backButton.hide()
      backButton.offClick(handleBack)
    }
  }, [navigate])

  const handleApprove = async (id: number) => {
    haptic('medium')
    setBusyId(id)
    try {
      await approveAdminCharge(id)
      showNotification('شارژ تأیید و به کیف پول اضافه شد')
      await reloadAfterMutation()
    } catch (error) {
      showNotification(error instanceof Error ? error.message : 'تأیید ناموفق بود', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const openReject = (id: number) => {
    haptic('light')
    setRejectId(id)
    setRejectNote('')
  }

  const closeReject = () => {
    if (busyId != null) return
    setRejectId(null)
    setRejectNote('')
  }

  const confirmReject = async () => {
    if (rejectId == null) return
    setBusyId(rejectId)
    try {
      await rejectAdminCharge(rejectId, rejectNote.trim() || undefined)
      showNotification('درخواست رد شد', 'warning')
      setRejectId(null)
      setRejectNote('')
      await reloadAfterMutation()
    } catch (error) {
      showNotification(error instanceof Error ? error.message : 'رد درخواست ناموفق بود', 'error')
    } finally {
      setBusyId(null)
    }
  }

  if (!ready) return null

  return (
    <div className="admin-section">
      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title="درخواست‌های شارژ" onBack={() => navigate('/admin')} />
      </div>

      <div className="admin-tabs shop-rise" style={{ '--rise-index': 1 } as CSSProperties}>
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`admin-tabs__btn${tab === item.id ? ' admin-tabs__btn--active' : ''}`}
            onClick={() => setTab(item.id)}
          >
            <SolarIcon icon={item.icon} width={15} height={15} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="admin-charge-list" aria-busy="true" aria-label="در حال بارگذاری">
          {[0, 1, 2].map((index) => (
            <ChargeItemSkeleton key={index} index={index} />
          ))}
        </div>
      ) : null}

      {!loading && charges.length === 0 ? <p className="admin-empty">موردی یافت نشد</p> : null}

      {!loading && charges.length > 0 ? (
      <div className="admin-charge-list">
        {charges.map((charge, index) => {
          const receiptSrc = resolveUploadUrl(charge.receiptUrl)
          const createdLabel = charge.createdAt
            ? new Date(charge.createdAt).toLocaleString('fa-IR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })
            : null
          const cardLabel = charge.bankCard
            ? formatCardNumberDisplay(charge.bankCard.cardNumber)
            : 'کارت حذف‌شده'
          const identity = userIdentity(charge)

          return (
            <article
              key={charge.id}
              className={`admin-charge-item shop-rise admin-charge-item--${charge.status}`}
              style={{ '--rise-index': Math.min(index + 2, 8) } as CSSProperties}
            >
              <div className="admin-charge-item__header">
                <button
                  type="button"
                  className="admin-charge-item__thumb"
                  onClick={() => setViewerSrc(receiptSrc)}
                  aria-label="نمایش رسید"
                >
                  <img src={receiptSrc} alt="" />
                  <span className="admin-charge-item__thumb-hint" aria-hidden>
                    <SolarIcon icon="solar:magnifer-zoom-in-linear" width={14} height={14} />
                  </span>
                </button>

                <div className="admin-charge-item__summary">
                  <div className="admin-charge-item__title-row">
                    <h3 className="admin-charge-item__user">{userLabel(charge)}</h3>
                    <span
                      className={`admin-charge-item__badge admin-charge-item__badge--${charge.status}`}
                    >
                      {charge.status === 'pending'
                        ? 'در انتظار'
                        : charge.status === 'approved'
                          ? 'تأیید شده'
                          : 'رد شده'}
                    </span>
                  </div>

                  <p className="admin-charge-item__amount">
                    <span className="admin-charge-item__amount-unit">تومان</span>
                    <span className="admin-charge-item__amount-num">
                      {charge.amountToman.toLocaleString('fa-IR')}
                    </span>
                  </p>
                </div>
              </div>

              <div className="admin-charge-item__meta">
                <div className="admin-charge-item__meta-chip">
                  <SolarIcon icon="solar:user-id-linear" width={12} height={12} />
                  <span dir="ltr">{identity.telegramId}</span>
                </div>
                {identity.username ? (
                  <div className="admin-charge-item__meta-chip">
                    <SolarIcon icon="solar:mention-circle-linear" width={12} height={12} />
                    <span dir="ltr">{identity.username}</span>
                  </div>
                ) : null}
                <div className="admin-charge-item__meta-chip">
                  <SolarIcon icon="solar:card-linear" width={12} height={12} />
                  <span dir="ltr">{cardLabel}</span>
                </div>
                {createdLabel ? (
                  <div className="admin-charge-item__meta-chip">
                    <SolarIcon icon="solar:calendar-linear" width={12} height={12} />
                    <span>{createdLabel}</span>
                  </div>
                ) : null}
              </div>

              {charge.adminNote ? (
                <p className="admin-charge-item__note">
                  <SolarIcon icon="solar:info-circle-linear" width={14} height={14} />
                  <span>{charge.adminNote}</span>
                </p>
              ) : null}

              {charge.status === 'pending' ? (
                <div className="admin-charge-item__actions">
                  <button
                    type="button"
                    className="admin-charge-item__btn admin-charge-item__btn--approve"
                    disabled={busyId === charge.id}
                    onClick={() => void handleApprove(charge.id)}
                  >
                    تأیید
                  </button>
                  <button
                    type="button"
                    className="admin-charge-item__btn admin-charge-item__btn--reject"
                    disabled={busyId === charge.id}
                    onClick={() => openReject(charge.id)}
                  >
                    رد
                  </button>
                </div>
              ) : null}
            </article>
          )
        })}
      </div>
      ) : null}

      <ImageViewer
        isOpen={Boolean(viewerSrc)}
        src={viewerSrc}
        alt="رسید واریز"
        onClose={() => setViewerSrc(null)}
      />

      <RejectReasonModal
        isOpen={rejectId != null}
        note={rejectNote}
        busy={busyId === rejectId}
        onNoteChange={setRejectNote}
        onClose={closeReject}
        onConfirm={() => void confirmReject()}
      />

      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification((prev) => ({ ...prev, show: false }))}
      />
    </div>
  )
}
