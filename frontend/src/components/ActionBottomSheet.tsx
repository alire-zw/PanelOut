import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { lockAppScroll, unlockAppScroll } from '../lib/scrollLock'
import './ActionBottomSheet.css'

export type ActionBottomSheetConfirmVariant = 'primary' | 'danger' | 'success'

type ActionBottomSheetProps = {
  isOpen: boolean
  onClose: () => void
  title: string
  description?: string
  children?: ReactNode
  cancelLabel?: string
  confirmLabel: string
  confirmVariant?: ActionBottomSheetConfirmVariant
  busy?: boolean
  confirmDisabled?: boolean
  onConfirm: () => void
}

export function ActionBottomSheet({
  isOpen,
  onClose,
  title,
  description,
  children,
  cancelLabel = 'انصراف',
  confirmLabel,
  confirmVariant = 'primary',
  busy = false,
  confirmDisabled = false,
  onConfirm,
}: ActionBottomSheetProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [shouldRender, setShouldRender] = useState(false)

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
      if (event.key === 'Escape' && isOpen && !busy) onClose()
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [busy, isOpen, onClose])

  if (!shouldRender) return null

  const confirmClass =
    confirmVariant === 'danger'
      ? 'action-sheet__btn--danger'
      : confirmVariant === 'success'
        ? 'action-sheet__btn--success'
        : 'action-sheet__btn--primary'

  return createPortal(
    <>
      <div
        className={`action-sheet__backdrop${isVisible ? ' action-sheet__backdrop--visible' : ''}`}
        onClick={() => {
          if (!busy) onClose()
        }}
        role="presentation"
      />

      <div
        className={`action-sheet__panel${isVisible ? ' action-sheet__panel--visible' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="action-sheet-title"
      >
        <div className="action-sheet__header">
          <div className="action-sheet__handle" aria-hidden />
          <h2 id="action-sheet-title" className="action-sheet__title">
            {title}
          </h2>
        </div>

        <div className="action-sheet__body">
          {description ? <p className="action-sheet__desc">{description}</p> : null}
          {children ? <div className="action-sheet__content">{children}</div> : null}
          <div className="action-sheet__actions">
            <button
              type="button"
              className="action-sheet__btn action-sheet__btn--ghost"
              disabled={busy}
              onClick={onClose}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              className={`action-sheet__btn ${confirmClass}`}
              disabled={busy || confirmDisabled}
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}
