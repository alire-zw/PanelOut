import { useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useTelegram } from '../hooks/useTelegram'
import ArrowBackIcon from './icons/ArrowBackIcon'
import './PageHeader.css'

interface PageHeaderProps {
  title: string
  onBack?: () => void
  action?: ReactNode
}

export function PageHeader({ title, onBack, action }: PageHeaderProps) {
  const navigate = useNavigate()
  const { haptic } = useTelegram()

  const handleBack = () => {
    haptic('light')
    if (onBack) {
      onBack()
    } else {
      navigate(-1)
    }
  }

  return (
    <header className="page-header">
      <div className="page-header__content">
        <button type="button" className="page-header__back" onClick={handleBack} aria-label="بازگشت">
          <ArrowBackIcon width={20} height={20} />
        </button>
        <h1 className="page-header__title">{title}</h1>
        <div className={`page-header__options${action ? ' page-header__options--filled' : ''}`}>
          {action ?? null}
        </div>
      </div>
    </header>
  )
}
