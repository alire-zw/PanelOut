import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { lockAppScroll, unlockAppScroll } from '../lib/scrollLock'
import './CenterModal.css'

export interface CenterModalButton {
  label: string
  onClick: () => void
  variant?: 'primary' | 'default' | 'danger'
  disabled?: boolean
}

interface CenterModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description?: string
  children?: ReactNode
  buttons?: CenterModalButton[]
  showCloseButton?: boolean
}

export function CenterModal({
  isOpen,
  onClose,
  title,
  description,
  children,
  buttons,
  showCloseButton = true,
}: CenterModalProps) {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    let timeoutId: number | undefined
    const initialHeight = window.innerHeight

    const handleResize = () => {
      if (timeoutId) window.clearTimeout(timeoutId)
      timeoutId = window.setTimeout(() => {
        const currentHeight = window.visualViewport?.height ?? window.innerHeight
        const heightDifference = initialHeight - currentHeight
        setIsKeyboardOpen(heightDifference > 150)
      }, 50)
    }

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize)
    } else {
      window.addEventListener('resize', handleResize)
    }

    handleResize()

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId)
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize)
      } else {
        window.removeEventListener('resize', handleResize)
      }
    }
  }, [isOpen])

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      lockAppScroll()
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      unlockAppScroll()
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div
      className={`center-modal${isKeyboardOpen ? ' center-modal--keyboard' : ''}`}
      onClick={onClose}
      role="presentation"
    >
      <div
        className="center-modal__panel"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="center-modal__header">
          <div className="center-modal__title">{title}</div>
          {showCloseButton && (
            <button
              type="button"
              className="center-modal__close"
              onClick={onClose}
              aria-label="بستن"
            >
              <svg fillRule="evenodd" viewBox="64 64 896 896" focusable="false" width="1em" height="1em" fill="currentColor">
                <path d="M799.86 166.31c.02 0 .04.02.08.06l57.69 57.7c.04.03.05.05.06.08a.12.12 0 010 .06c0 .03-.02.05-.06.09L569.93 512l287.7 287.7c.04.04.05.06.06.09a.12.12 0 010 .07c0 .02-.02.04-.06.08l-57.7 57.69c-.03.04-.05.05-.07.06a.12.12 0 01-.07 0c-.03 0-.05-.02-.09-.06L512 569.93l-287.7 287.7c-.04.04-.06.05-.09.06a.12.12 0 01-.07 0c-.02 0-.04-.02-.08-.06l-57.69-57.7c-.04-.03-.05-.05-.06-.07a.12.12 0 010-.07c0-.03.02-.05.06-.09L454.07 512l-287.7-287.7c-.04-.04-.05-.06-.06-.09a.12.12 0 010-.07c0-.02.02-.04.06-.08l57.7-57.69c.03-.04.05-.05.07-.06a.12.12 0 01.07 0c.03 0 .05.02.09.06L512 454.07l287.7-287.7c.04-.04.06-.05.09-.06a.12.12 0 01.07 0z" />
              </svg>
            </button>
          )}
        </div>

        <div className="center-modal__body">
          {description && <blockquote className="center-modal__description">{description}</blockquote>}
          {children}
        </div>

        {buttons && buttons.length > 0 && (
          <div className="center-modal__footer">
            <div className="center-modal__actions">
              {buttons.map((button) => (
                <button
                  key={button.label}
                  type="button"
                  className={`center-modal__btn center-modal__btn--${button.variant ?? 'default'}`}
                  onClick={button.onClick}
                  disabled={button.disabled}
                >
                  {button.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
