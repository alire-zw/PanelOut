import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import CopyIcon from './icons/CopyIcon'
import { lockAppScroll, unlockAppScroll } from '../lib/scrollLock'
import { useTelegram } from '../hooks/useTelegram'
import { formatFaTraffic } from '../lib/formatTraffic'
import type { PanelSubscription } from '../lib/panelApi'
import './PanelDetailSheet.css'

type PanelDetailSheetProps = {
  isOpen: boolean
  panel: PanelSubscription | null
  onClose: () => void
  onCopySuccess: (message: string) => void
  onOpenAllocate?: (panel: PanelSubscription) => void
  onDeactivateOutbound?: (panel: PanelSubscription) => void
}

function serviceLabel(panel: PanelSubscription) {
  if (panel.isOutboundVolume || panel.serviceType === 'outbound_volume') return 'اوتباند حجمی'
  if (panel.isOutboundUsage || panel.serviceType === 'outbound_usage') return 'اوتباند مصرفی'
  if (panel.isReseller || panel.serviceType === 'panel_reseller') return 'ریسلری'
  if (panel.isTrial || panel.serviceType === 'panel_trial') return 'تست'
  return 'مصرفی شخصی'
}

function statusLabel(status: string) {
  if (status === 'suspended') return 'تعلیق'
  if (status === 'deactivated') return 'غیرفعال'
  if (status === 'expired') return 'منقضی'
  return 'فعال'
}

function formatFaNumber(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return '—'
  return Math.trunc(Number(value)).toLocaleString('fa-IR')
}

export function PanelDetailSheet({
  isOpen,
  panel: panelProp,
  onClose,
  onCopySuccess,
  onOpenAllocate,
  onDeactivateOutbound,
}: PanelDetailSheetProps) {
  const { haptic } = useTelegram()
  const [isVisible, setIsVisible] = useState(false)
  const [shouldRender, setShouldRender] = useState(false)
  const [heldPanel, setHeldPanel] = useState(panelProp)

  useEffect(() => {
    if (panelProp) setHeldPanel(panelProp)
  }, [panelProp])

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsVisible(true))
      })
      return
    }

    setIsVisible(false)
    const timer = window.setTimeout(() => setShouldRender(false), 480)
    return () => window.clearTimeout(timer)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      unlockAppScroll()
      return
    }

    lockAppScroll()
    return () => unlockAppScroll()
  }, [isOpen])

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) onClose()
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  const handleCopy = useCallback(
    async (text: string, label: string) => {
      try {
        await navigator.clipboard.writeText(text)
        haptic('light')
        onCopySuccess(`${label} کپی شد`)
      } catch {
        onCopySuccess('کپی ناموفق بود')
      }
    },
    [haptic, onCopySuccess],
  )

  if (!shouldRender || !heldPanel) return null

  const panel = heldPanel
  const isOutbound =
    panel.isOutbound ||
    panel.serviceType === 'outbound_volume' ||
    panel.serviceType === 'outbound_usage'
  const isReseller = panel.isReseller || panel.serviceType === 'panel_reseller'
  const isTrial = panel.isTrial || panel.serviceType === 'panel_trial'
  const isPrepaid = panel.capacityMode === 'prepaid'
  const connectionLink = panel.connectionLink ?? null
  const walletShown = isReseller
    ? panel.walletBalance ?? 0
    : panel.displayWalletBalance ?? 0

  return createPortal(
    <>
      <div
        className={`panel-detail__backdrop${
          isVisible ? ' panel-detail__backdrop--visible' : ''
        }`}
        onClick={onClose}
        role="presentation"
      />

      <div
        className={`panel-detail__panel${
          isVisible ? ' panel-detail__panel--visible' : ''
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="مشخصات پنل"
      >
        <div className="panel-detail__header">
          <div className="panel-detail__handle" aria-hidden />
          <h3 className="panel-detail__title">
            {isOutbound ? 'مشخصات اوتباند' : 'مشخصات و دسترسی پنل'}
          </h3>
        </div>

        <div className="panel-detail__content">
          {isOutbound ? (
            <div className="panel-detail__creds-group">
              <div className="panel-detail__cred-card">
                <span className="panel-detail__cred-label">نام سرویس</span>
                <div
                  className="panel-detail__cred-box"
                  onClick={() => handleCopy(panel.clientUsername, 'نام سرویس')}
                  role="button"
                  tabIndex={0}
                >
                  <span
                    className="panel-detail__cred-text panel-detail__cred-text--mono"
                    dir="ltr"
                  >
                    {panel.clientUsername}
                  </span>
                  <span className="panel-detail__copy-badge">
                    <CopyIcon width={12} height={12} color="currentColor" />
                    <span>کپی</span>
                  </span>
                </div>
              </div>
              {connectionLink ? (
                <div className="panel-detail__cred-card">
                  <span className="panel-detail__cred-label">لینک اتصال</span>
                  <div
                    className="panel-detail__cred-box"
                    onClick={() => handleCopy(connectionLink, 'لینک اتصال')}
                    role="button"
                    tabIndex={0}
                  >
                    <span className="panel-detail__cred-text" dir="ltr">
                      {connectionLink}
                    </span>
                    <span className="panel-detail__copy-badge">
                      <CopyIcon width={12} height={12} color="currentColor" />
                      <span>کپی</span>
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
          <div className="panel-detail__creds-group">
            <div className="panel-detail__cred-card">
              <span className="panel-detail__cred-label">آدرس ورود به پنل</span>
              <div
                className="panel-detail__cred-box"
                onClick={() => handleCopy(panel.panelUrl, 'آدرس پنل')}
                role="button"
                tabIndex={0}
              >
                <span className="panel-detail__cred-text" dir="ltr">
                  {panel.panelUrl}
                </span>
                <span className="panel-detail__copy-badge">
                  <CopyIcon width={12} height={12} color="currentColor" />
                  <span>کپی</span>
                </span>
              </div>
            </div>

            <div className="panel-detail__creds-row">
              <div className="panel-detail__cred-card">
                <span className="panel-detail__cred-label">نام کاربری ادمین</span>
                <div
                  className="panel-detail__cred-box"
                  onClick={() => handleCopy(panel.clientUsername, 'نام کاربری')}
                  role="button"
                  tabIndex={0}
                >
                  <span
                    className="panel-detail__cred-text panel-detail__cred-text--mono"
                    dir="ltr"
                  >
                    {panel.clientUsername}
                  </span>
                  <span className="panel-detail__copy-badge">
                    <CopyIcon width={12} height={12} color="currentColor" />
                    <span>کپی</span>
                  </span>
                </div>
              </div>

              <div className="panel-detail__cred-card">
                <span className="panel-detail__cred-label">رمز عبور ادمین</span>
                {panel.adminPassword ? (
                  <div
                    className="panel-detail__cred-box"
                    onClick={() => handleCopy(panel.adminPassword!, 'رمز عبور')}
                    role="button"
                    tabIndex={0}
                  >
                    <span
                      className="panel-detail__cred-text panel-detail__cred-text--mono"
                      dir="ltr"
                    >
                      {panel.adminPassword}
                    </span>
                    <span className="panel-detail__copy-badge">
                      <CopyIcon width={12} height={12} color="currentColor" />
                      <span>کپی</span>
                    </span>
                  </div>
                ) : (
                  <div className="panel-detail__cred-box panel-detail__cred-box--disabled">
                    <span className="panel-detail__cred-text panel-detail__cred-text--muted">
                      رمز قبلی اکانت
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
          )}

          {/* Table summary stats */}
          <div className="panel-detail__table">
            <div className="panel-detail__row">
              <span className="panel-detail__row-label">نوع سرویس</span>
              <span className="panel-detail__row-value">{serviceLabel(panel)}</span>
            </div>

            <div className="panel-detail__row">
              <span className="panel-detail__row-label">وضعیت</span>
              <span
                className={`panel-detail__status panel-detail__status--${panel.status}`}
              >
                {statusLabel(panel.status)}
              </span>
            </div>

            {!isOutbound ? (
            <div className="panel-detail__row">
              <span className="panel-detail__row-label">تعداد کاربران در پنل</span>
              <span className="panel-detail__row-value">
                {panel.totalUsers != null
                  ? `${formatFaNumber(panel.totalUsers)} کاربر`
                  : '—'}
              </span>
            </div>
            ) : null}

            <div className="panel-detail__row">
              <span className="panel-detail__row-label">کل ترافیک مصرف‌شده</span>
              <span className="panel-detail__row-value">
                {formatFaTraffic(panel.usedTrafficGb, 'long')}
              </span>
            </div>

            <div className="panel-detail__row">
              <span className="panel-detail__row-label">
                {isOutbound && panel.serviceType === 'outbound_volume'
                  ? 'حجم باقی‌مانده'
                  : isTrial
                  ? 'حجم باقی‌مانده تست'
                  : isPrepaid
                    ? 'حجم باقی‌مانده پرداخت‌شده'
                    : 'حجم قابل‌مصرف با موجودی'}
              </span>
              <span className="panel-detail__row-value">
                {formatFaTraffic(panel.remainingTrafficGb, 'long')}
              </span>
            </div>

            <div className="panel-detail__row">
              <span className="panel-detail__row-label">
                {isOutbound
                  ? 'موجودی کیف پول'
                  : isReseller
                  ? 'موجودی کیف پنل'
                  : isTrial
                    ? 'حجم کل تست'
                    : isPrepaid
                      ? 'حجم پرداخت‌شده'
                      : 'موجودی کیف اصلی'}
              </span>
              <span className="panel-detail__row-value">
                {isTrial
                  ? `${formatFaNumber(panel.trialVolumeGb ?? 5)} گیگابایت`
                  : isPrepaid
                    ? formatFaTraffic(panel.prepaidTrafficGb, 'long')
                    : `${formatFaNumber(walletShown)} تومان`}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="panel-detail__actions">
            {!isOutbound ? (
            <button
              type="button"
              className="panel-detail__btn panel-detail__btn--primary"
              onClick={() => {
                haptic('light')
                window.open(panel.panelUrl, '_blank', 'noopener,noreferrer')
              }}
            >
              ورود به پنل
            </button>
            ) : connectionLink ? (
            <button
              type="button"
              className="panel-detail__btn panel-detail__btn--primary"
              onClick={() => void handleCopy(connectionLink, 'لینک اتصال')}
            >
              کپی لینک اتصال
            </button>
            ) : null}
            {panel.serviceType === 'outbound_usage' && onDeactivateOutbound ? (
              <button
                type="button"
                className="panel-detail__btn panel-detail__btn--ghost"
                onClick={() => {
                  onClose()
                  onDeactivateOutbound(panel)
                }}
              >
                غیرفعال‌سازی
              </button>
            ) : isReseller && onOpenAllocate ? (
              <button
                type="button"
                className="panel-detail__btn panel-detail__btn--ghost"
                onClick={() => {
                  onClose()
                  onOpenAllocate(panel)
                }}
              >
                موجودی پنل
              </button>
            ) : (
              <button
                type="button"
                className="panel-detail__btn panel-detail__btn--ghost"
                onClick={onClose}
              >
                بستن
              </button>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}
