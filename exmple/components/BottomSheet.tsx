import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { lockAppScroll, unlockAppScroll } from '../lib/scrollLock'
import './BottomSheet.css'

export interface BottomSheetOption {
  value: string
  label: string
  icon?: ReactNode
}

interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  title: string
  options: BottomSheetOption[]
  selectedValue: string | string[]
  onSelect: (value: string) => void
}

function hasCustomIconColor(icon: ReactNode): boolean {
  if (!icon || typeof icon !== 'object' || !('props' in icon)) return false
  const props = icon.props as { color?: string }
  return typeof props.color === 'string'
}

export function BottomSheet({
  isOpen,
  onClose,
  title,
  options,
  selectedValue,
  onSelect,
}: BottomSheetProps) {
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
    const timer = window.setTimeout(() => setShouldRender(false), 450)
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

  const handleSelect = (value: string) => {
    onSelect(value)
    onClose()
  }

  if (!shouldRender) return null

  return createPortal(
    <>
      <div
        className={`bottom-sheet__backdrop${isVisible ? ' bottom-sheet__backdrop--visible' : ''}`}
        onClick={onClose}
        role="presentation"
      />

      <div
        className={`bottom-sheet__panel${isVisible ? ' bottom-sheet__panel--visible' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="bottom-sheet__header">
          <div className="bottom-sheet__handle" aria-hidden />
          <h3 className="bottom-sheet__title">{title}</h3>
        </div>

        <div className="bottom-sheet__options">
          {options.map((option) => {
            const isSelected = Array.isArray(selectedValue)
              ? selectedValue.includes(option.value)
              : selectedValue === option.value
            const customColor = hasCustomIconColor(option.icon)

            return (
              <button
                key={option.value}
                type="button"
                className={`bottom-sheet__option${isSelected ? ' bottom-sheet__option--selected' : ''}`}
                onClick={() => handleSelect(option.value)}
              >
                {option.icon && <span className="bottom-sheet__option-icon">{option.icon}</span>}
                <span
                  className="bottom-sheet__option-label"
                  style={isSelected && customColor ? { color: 'var(--text)' } : undefined}
                >
                  {option.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </>,
    document.body,
  )
}
